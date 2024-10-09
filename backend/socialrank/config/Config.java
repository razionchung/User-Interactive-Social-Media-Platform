package edu.upenn.cis.nets2120.config;

public class Config {

    // For test drivers
    public static void setSocialPath(String path) {
        SOCIAL_NET_PATH = path;
    }

    /**
     * paths to the s3 files
     */
    // TODO
    public static String GRAPH_U_H = "s3a://OUR_BUCKET_NAME/graph_u_h.txt";
    public static String GRAPH_H_P = "s3a://OUR_BUCKET_NAME/graph_h_p.txt";
    public static String GRAPH_U_P = "s3a://OUR_BUCKET_NAME/graph_u_p.txt";
    public static String GRAPH_U_U = "s3a://OUR_BUCKET_NAME/graph_u_u.txt";

    // public static String SOCIAL_NET_PATH = "src/main/java/edu/upenn/cis/nets2120/hw3/simple-example.txt";

    public static String LOCAL_SPARK = "local[*]";

    // public static String JAR = "target/nets2120-hw3-0.0.1-SNAPSHOT.jar";

    // these will be set via environment variables
    public static String ACCESS_KEY_ID = System.getenv("AWS_ACCESS_KEY_ID");
    public static String SECRET_ACCESS_KEY = System.getenv("AWS_SECRET_ACCESS_KEY");
    public static String SESSION_TOKEN = System.getenv("AWS_SESSION_TOKEN");

    /**
     * How many RDD partitions to use?
     */
    public static int PARTITIONS = 5;
}
