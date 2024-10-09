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

import edu.upenn.cis.nets2120.SparkJob;
import edu.upenn.cis.nets2120.config;
import scala.Tuple2;

public class SocialRankJob extends SparkJob<List<MyPair<String, Double>>> {
    /**
     *
     */
    private static final long serialVersionUID = 1L;

    private boolean useBacklinks;
    // Convergence condition variables
    protected double d_max; // largest change in a node's rank from iteration i to iteration i+1
    protected int i_max; // max number of iterations

    private static final String DB_URL = "jdbc:mysql://localhost:3306/socialmediadb";
    private static final String DB_USER = "admin";
    private static final String DB_PASSWORD = "rds-password";

    private String source;

    int max_answers = 1000;

    public SocialRankJob(double d_max, int i_max, int answers, boolean useBacklinks, boolean debug) {
        super(false, false, debug);
        this.useBacklinks = useBacklinks;
        this.d_max = d_max;
        this.i_max = i_max;
        this.max_answers = answers;
    }

    /**
     * Fetch the social network from the S3 path, and create a (followed, follower)
     * edge graph
     *
     * @param filePath
     * @return JavaPairRDD: (followed: String, follower: String)
     */
    protected JavaPairRDD<String, String> getSocialNetwork(JavaSparkContext context) {
        try (Connection connection = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD)) {
            String query = "SELECT followed_user_id, follower_user_id FROM friends";
            ResultSet resultSet = connection.createStatement().executeQuery(query);

            JavaRDD<Tuple2<String, String>> edgeRDD = context.parallelize(new ArrayList<>());
            while (resultSet.next()) {
                String followedUserId = resultSet.getString("followed_user_id");
                String followerUserId = resultSet.getString("follower_user_id");
                edgeRDD = edgeRDD.union(context.parallelize(Arrays.asList(
                        new Tuple2<>(followedUserId, followerUserId)
                )));
            }

            JavaPairRDD<String, String> socialNetwork = edgeRDD.distinct();

            // long nodeCount = socialNetwork.map(Tuple2::_1).union(socialNetwork.map(Tuple2::_2)).distinct().count();
            // long edgeCount = socialNetwork.count();
            // System.out.println("The social network contains " + nodeCount + " nodes and " + edgeCount + " edges");

            return socialNetwork;
        } catch (SQLException e) {
            e.printStackTrace();
            return null;
        }
    }

    /**
     * Retrieves the sinks from the given network.
     *
     * @param network the input network represented as a JavaPairRDD
     * @return a JavaRDD containing the nodes with no outgoing edges (sinks)
     */
    protected JavaRDD<String> getSinks(JavaPairRDD<String, String> network) {
        // TODO Your code from ComputeRanks here
        JavaRDD<String> allNodes = network.flatMap(tuple -> Arrays.asList(tuple._1, tuple._2).iterator()).distinct();
        JavaRDD<String> followingNodes = network.keys().distinct();
        JavaRDD<String> sinks = allNodes.subtract(followingNodes);
        return sinks;
    }

    /**
     * Main functionality in the program: read and process the social network
     * Runs the SocialRankJob and returns a list of the top 10 nodes with the highest SocialRank values.
     *
     * @param debug a boolean indicating whether to enable debug mode
     * @return a list of MyPair objects representing the top 10 nodes with their corresponding SocialRank values
     * @throws IOException          if there is an error reading the social network file
     * @throws InterruptedException if the execution is interrupted
     */
    
    public List<MyPair<String, Double>> run(boolean debug) throws IOException, InterruptedException {
        // System.out.println("Running");

        // Load the social network, aka. the edges (followed, follower)
        SparkSession spark = SparkSession.builder()
                .appName("SocialNetworkAnalysis")
                .getOrCreate();
        JavaSparkContext context = new JavaSparkContext(spark.sparkContext());

        JavaPairRDD<String, String> socialNetwork = getSocialNetwork(context);

        JavaPairRDD<String, String> fullNetwork;

        // Find the sinks in edgeRDD as PairRDD
        if (useBacklinks) {
            JavaRDD<String> sinks = getSinks(edgeRDD);
            // System.out.println("There are " + sinks.count() + " sinks");

            // TODO: Your code from ComputeRanks here
            // Adding backlinks
            JavaPairRDD<String, Iterable<String>> followers = edgeRDD.mapToPair(item -> new Tuple2<>(item._2(), item._1())).groupByKey().cache();
            JavaPairRDD<String, String> sinksPair = sinks.mapToPair(sink -> new Tuple2<>(sink, null));
            JavaPairRDD<String, Tuple2<String, Iterable<String>>> joined = sinksPair.join(followers);
            JavaPairRDD<String, String> backlinks = joined.flatMapToPair(joinResult -> {
                String sink = joinResult._1;
                Iterable<String> followersList = joinResult._2._2;
                List<Tuple2<String, String>> results = new ArrayList<>();
                for (String follower : followersList) {
                    results.add(new Tuple2<>(sink, follower));
                }
                return results.iterator();
            });

            // System.out.println("Added " + backlinks.count() + " backlinks");
            fullNetwork = edgeRDD.union(backlinks).distinct();
        } else {
            // Without backlinks
            fullNetwork = edgeRDD;
        }
        
        JavaPairRDD<String, Iterable<String>> followees = fullNetwork.groupByKey().cache();
        
        // Initialize ranks
        JavaPairRDD<String, Double> ranks = fullNetwork.flatMapToPair(t -> {
                                                List<Tuple2<String, Double>> nodes = new ArrayList<>();
                                                nodes.add(new Tuple2<>(t._1(), 1.0));
                                                nodes.add(new Tuple2<>(t._2(), 1.0));
                                                return nodes.iterator();
                                            }).reduceByKey((a, b) -> 1.0);
        
        double maxChange = Double.MAX_VALUE;
        int iteration = 0;
        
        while (iteration < i_max && maxChange >= d_max) {
            // Calculate contributions
            JavaPairRDD<String, Tuple2<Double, Iterable<String>>> ranksWithFollowees = ranks.join(followees);

            JavaPairRDD<String, Double> contributions = ranksWithFollowees
                .flatMapToPair(t -> {
                    Double rank = t._2._1;
                    Iterable<String> followers_it = t._2._2;
                    List<Tuple2<String, Double>> contribs = new ArrayList<>();
                    int followerCount = (int) StreamSupport.stream(followers_it.spliterator(), false).count();
                    if (followerCount > 0) {
                        Double contribution = rank / followerCount;
                        for (String follower : followers_it) {
                            contribs.add(new Tuple2<>(follower, contribution));
                        }
                    }
                    return contribs.iterator();
                });

            JavaPairRDD<String, Double> newRanks = contributions.reduceByKey(Double::sum).mapValues(sum -> 0.15 + 0.85 * sum);

            // System.out.println("Iteration: " + iteration);
            // newRanks.foreach(rank -> {
            //     System.out.println(rank._1 + " has rank: " + rank._2);
            // });

            // Calculate max change
            JavaPairRDD<String, Tuple2<Double, Double>> joinedRanks = ranks.join(newRanks);
            List<Tuple2<String, Double>> changes = joinedRanks.mapValues(pair -> Math.abs(pair._1 - pair._2)).collect();
            maxChange = 0.0;
            for (Tuple2<String, Double> change : changes) {
                if (change._2() > maxChange) {
                    maxChange = change._2();
                }
            }
            
            ranks = newRanks;
            iteration++;

            if (debug) {
                List<Tuple2<String, Double>> debugOutput = ranks.collect();
                debugOutput.forEach(t -> System.out.println(t._1 + " has rank: " + t._2));
            }
        }

        List<Tuple2<String, Double>> topRanksTuples = ranks.takeOrdered(max_answers, new RankComparator());
        List<MyPair<String, Double>> topRanks = topRanksTuples.stream()
                .map(tuple -> new MyPair<>(tuple._1, tuple._2))
                .collect(Collectors.toList());
        return topRanks;
    }

    static class RankComparator implements Comparator<Tuple2<String, Double>>, Serializable {
        private static final long serialVersionUID = 1L;
    
        @Override
        public int compare(Tuple2<String, Double> o1, Tuple2<String, Double> o2) {
            return o2._2.compareTo(o1._2);
        }
    }

    @Override
    public List<MyPair<String, Double>> call(JobContext arg0) throws Exception {
        initialize();
        return run(false);
    }

}
