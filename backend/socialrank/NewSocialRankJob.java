package edu.upenn.cis.nets2120.socialrank;

import java.io.IOException;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

import org.apache.livy.JobContext;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;

import com.google.cloud.hadoop.repackaged.gcs.com.google.common.collect.Iterables;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;

import scala.Tuple2;

public class SocialRankJob extends SparkJob<List<MyPair<String, Double>>> {
    /**
     *
     */
    private static final long serialVersionUID = 1L;

    private boolean useBacklinks;
    // Convergence condition variables
    protected double d_max = 0.01; // largest change in a node's rank from iteration i to iteration i+1
    protected int i_max = 15; // max number of iterations
    protected boolean debug; // print debug messages

    private static final String DB_URL = "jdbc:mysql://localhost:3306/socialmediadb";
    private static final String DB_USER = "admin";
    private static final String DB_PASSWORD = "rds-password";

    private String source;

    int max_answers = 1000;

    public class MySQLConnection {
        private Connection connection = null;
        public static Connection getConnection() {
            if (connection != null) {
                return connection;
            }
            try {
                DriverManager.registerDriver(new com.mysql.cj.jdbc.Driver());
                connection = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
            } catch (SQLException e) {
                e.printStackTrace();
                System.out.println("Failed to create the database connection.");
            }
            return connection;
        }
    }

    public void fetchDataFromDatabase() throws IOException {
        Connection conn = MySQLConnection.getConnection();  
        String[] fileNames = {"graph_u_h.txt", "graph_h_p.txt", "graph_u_p.txt", "graph_u_u.txt"};
        String[] queries = {
            "SELECT user_id, hashtag FROM user_hashtags UNION SELECT hashtag, user_id FROM user_hashtags",

            "SELECT hashtag, post_id FROM postHashtag UNION SELECT post_id, hashtag FROM postHashtag",

            "SELECT user_id, post_id FROM post; UNION SELECT post_id, user_id FROM post",

            "SELECT DISTINCT f1.followed AS user1_id, f1.follower AS user2_id FROM friends AS f1 JOIN friends AS f2 ON f1.followed = f2.follower AND f1.follower = f2.followed"
            };
        for (int i = 0; i < queries.length; i++) {
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery(queries[i]);
                 FileWriter writer = new FileWriter(fileNames[i])) {

                while (rs.next()) {
                    String node1 = rs.getString(1);
                    String node2 = rs.getString(2);
                    writer.write(node1 + " " + node2 + "\n");ß
                }
            } catch (SQLException e) {
                e.printStackTrace();
                System.out.println("Failed to query data for graph type " + (i + 1));
            }
        }
    }

    SparkSession spark;
	JavaSparkContext context;

    /**
	 * Initialize the database connection
	 * 
	 * @throws IOException
	 * @throws InterruptedException 
	 */
	public void initialize() throws IOException, InterruptedException {
		spark = SparkConnector.getSparkConnection();
		context = SparkConnector.getSparkContext();
	}

    /**
	 * Build graph from txt file
	 * 
	 * @param filePath
	 * @return JavaPairRDD: (n1, n2)
	 */
    JavaPairRDD<String, String> getGraph(int graphType, String filePath) {
        if (graphType == 1) {
            return context
            .textFile(filePath, 5)
            .flatMapToPair(row -> {
                String[] array = row.split(" ");
                List<Tuple2<String, String>> pairs = new ArrayList<>();
                pairs.add(new Tuple2<>("U_" + array[0], "H_" + array[1]));
                pairs.add(new Tuple2<>("H_" + array[1], "U_" + array[0]));
                return pairs.iterator();
            })
            .distinct();
        } else if (graphType == 2) {
            return context
            .textFile(filePath, 5)
            .flatMapToPair(row -> {
                String[] array = row.split(" ");
                List<Tuple2<String, String>> pairs = new ArrayList<>();
                pairs.add(new Tuple2<>("H_" + array[0], "P_" + array[1]));
                pairs.add(new Tuple2<>("P_" + array[1], "H_" + array[0]));
                return pairs.iterator();
            })
            .distinct();
        } else if (graphType == 3) {
            return context
            .textFile(filePath, 5)
            .flatMapToPair(row -> {
                String[] array = row.split(" ");
                List<Tuple2<String, String>> pairs = new ArrayList<>();
                pairs.add(new Tuple2<>("U_" + array[0], "P_" + array[1]));
                pairs.add(new Tuple2<>("P_" + array[1], "U_" + array[0]));
                return pairs.iterator();
            })
            .distinct();
        } else if (graphType == 4) {
            return context
            .textFile(filePath, 5)
            .flatMapToPair(row -> {
                String[] array = row.split(" ");
                List<Tuple2<String, String>> pairs = new ArrayList<>();
                pairs.add(new Tuple2<>("U_" + array[0], "U_" + array[1]));
                pairs.add(new Tuple2<>("U_" + array[1], "U_" + array[0]));
                return pairs.iterator();
            })
            .distinct();
        }
    }

    /**
     * Assign weights to the edges
     * (n1, n2), weight -> (n1, (n2, weight / deg))
     * 
     */
    JavaPairRDD<String, Tuple2<String, Double>> assignWeightsToEdges(JavaPairRDD<String, String> graph, double totalWeightSum) {
        JavaPairRDD<String, Integer> outDegrees = graph
            .mapToPair(x -> new Tuple2<>(x._1, 1))
            .reduceByKey((a, b) -> a + b);

        return graph
            .mapToPair(edge -> new Tuple2<>(edge._1, new Tuple2<>(edge._2, 1)))  // (source, 1)
            .join(outDegrees)  // (source, 1) x outdeg
            .mapToPair(joined -> {
                String source = joined._1;
                String target = joined._2._1._1;
                Integer outDegree = joined._2._2;
                Double weight = totalWeightSum / outDegree; // (source, weight / outdeg)
                return new Tuple2<>(source, new Tuple2<>(target, weight));
            });
    }

    public List<MyPair<MyPair<String, String>, Double>> run() throws IOException, InterruptedException {
        fetchDataFromDatabase();
        initialize();
        // build graph from txt files
        // JavaPairRDD<String, String> graph_u_h = getGraph(1, Config.GRAPH_U_H); 
        // JavaPairRDD<String, String> graph_h_p = getGraph(2, Config.GRAPH_H_P);
        // JavaPairRDD<String, String> graph_u_p = getGraph(3, Config.GRAPH_U_P);
        // JavaPairRDD<String, String> graph_u_u = getGraph(4, Config.GRAPH_U_U);    
        JavaPairRDD<String, String> graph_u_h = getGraph(1, "graph_u_h.txt");
        JavaPairRDD<String, String> graph_h_p = getGraph(2, "graph_h_p.txt");
        JavaPairRDD<String, String> graph_u_p = getGraph(3, "graph_u_p.txt");
        JavaPairRDD<String, String> graph_u_u = getGraph(4, "graph_u_u.txt");  

        // assign weights to the edges
        JavaPairRDD<String, Tuple2<String, Double>> weighted_edges_h_p = assignWeightsToEdges(graph_h_p, 1.0);
        JavaPairRDD<String, Tuple2<String, Double>> weighted_edges_u_h = assignWeightsToEdges(graph_u_h, 0.3);
        JavaPairRDD<String, Tuple2<String, Double>> weighted_edges_u_p = assignWeightsToEdges(graph_u_p, 0.4);
        JavaPairRDD<String, Tuple2<String, Double>> weighted_edges_u_u = assignWeightsToEdges(graph_u_u, 0.3);

        // combine all graphs into one
        JavaPairRDD<String, Tuple2<String, Double>> combinedGraph = weightedGraphUH
            .union(weightedGraphHP)
            .union(weightedGraphUP)
            .union(weightedGraphUU);

        // initialize node scores to 1.0
        JavaPairRDD<String, Tuple2<String, Double>> nodeScores = combinedGraph
            .flatMapToPair(edge -> {
                List<Tuple2<String, Tuple2<String, Double>>> initialScores = new ArrayList<>();
                initialScores.add(new Tuple2<>(edge._1(), new Tuple2<>(edge._1(), 1.0))); 
                initialScores.add(new Tuple2<>(edge._2()._1, new Tuple2<>(edge._1(), 1.0)));
                return initialScores.iterator();
            })
            .reduceByKey((x, y) -> x);

        double convergenceThreshold = 0.01;

        // run adsorption until convergence or max iterations
        for (int i = 0; i < i_max && d_max > convergenceThreshold; i++) {
            // JavaPairRDD<String, Double> newScores = combinedGraph
            //     .join(nodeScores)
            //     .mapToPair(data -> new Tuple2<>(data._2._1._1, data._2._1._2 * data._2._2))
            //     .reduceByKey((x, y) -> x + y);

            // // update d_max
            // d_max = nodeScores
            //     .join(newScores)
            //     .mapToDouble(x -> Math.abs(x._2._1 - x._2._2))
            //     .max();
            // nodeScores = newScores;

            JavaPairRDD<String, Tuple2<String, Double>> newScores = combinedGraph
                .join(nodeScores)
                .flatMapToPair(data -> {
                    String source = data._1;
                    String destination = data._2._1._1;
                    double edgeWeight = data._2._1._2;
                    String origin = data._2._2._1;
                    double sourceScore = data._2._2._2;
                    double propagatedScore = sourceScore * edgeWeight;
                    return Arrays.asList(new Tuple2<>(destination, new Tuple2<>(origin, propagatedScore))).iterator();
                })
                .reduceByKey((x, y) -> new Tuple2<>(x._1, x._2 + y._2));

            // Normalizing scores
            JavaPairRDD<String, Iterable<Tuple2<String, Double>>> groupedScores = newScores.groupByKey();
            JavaPairRDD<String, Tuple2<String, Double>> normalizedScores = groupedScores.flatMapToPair(group -> {
                double total = 0.0;
                for (Tuple2<String, Double> score : group._2) {
                    total += score._2;
                }
                List<Tuple2<String, Tuple2<String, Double>>> results = new ArrayList<>();
                for (Tuple2<String, Double> score : group._2) {
                    results.add(new Tuple2<>(group._1, new Tuple2<>(score._1, score._2 / total)));
                }
                return results.iterator();
            });

            // Update d_max
            d_max = normalizedScores
                .join(nodeScores)
                .mapToDouble(pair -> Math.abs(pair._2._1._2 - pair._2._2._2))
                .max();

            nodeScores = normalizedScores;
        }
        nodeScores.cache();
    }
}