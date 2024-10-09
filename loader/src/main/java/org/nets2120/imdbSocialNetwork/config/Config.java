package org.nets2120.imdbSocialNetwork.config;

public class Config {
    public static final String DATABASE_CONNECTION = "jdbc:mysql://localhost:3306/socialmediadb";
    public static final String DATABASE_USERNAME = "admin";
    public static final String DATABASE_PASSWORD = "rds-password";

    public static final String SPARK_APP_NAME = "IMDBRelations";
    public static final String SPARK_MASTER_URL = "local[*]";
    public static final String SPARK_DRIVER_MEMORY = "10g";
    public static final String SPARK_TESTING_MEMORY = "2147480000";

    public static final String[] IMDB_FILES = {"datasets/names.tsv", "datasets/principals.tsv", "datasets/ratings.tsv", "datasets/titles.tsv"};
}
