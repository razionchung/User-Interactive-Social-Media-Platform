package org.nets2120.imdbSocialNetwork;

import org.apache.spark.SparkConf;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SaveMode;
import org.apache.spark.sql.SparkSession;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.List;
import java.util.ArrayList;

import org.nets2120.imdbSocialNetwork.config.Config;

public class DataLoader {

    static final String[] files = Config.IMDB_FILES;
    
    public static void main(String[] args) {
        try {
            System.out.println("----MySQL JDBC Connection Testing -------");

            try {
                Class.forName("com.mysql.cj.jdbc.Driver");
            } catch (Exception ex) {
                // handle the error
                System.out.println("Error: " + ex.getMessage());
                System.exit(1);
            }    
            
            Connection connection = null;

            try {
                connection = DriverManager.getConnection(Config.DATABASE_CONNECTION, Config.DATABASE_USERNAME, Config.DATABASE_PASSWORD);
            } catch (SQLException e) {
                System.out.println("Connection to database failed! Please make sure the RDS server is correct, the tunnel is enabled, and you have run the mysql command to create the database:\n" + e.getMessage());
                System.exit(1);
            }

            if (connection != null) {
                System.out.println("Connection successful!");
            } else {
                System.out.println("Failed to make connection");
            }

            // Set up Spark configuration
            SparkConf sparkConf = new SparkConf()
                    .setAppName(Config.SPARK_APP_NAME)
                    .setMaster(Config.SPARK_MASTER_URL) // Set the master URL, "local[*]" for local mode
                    .set("spark.driver.memory", Config.SPARK_DRIVER_MEMORY) // Set the driver memory to 10 gigabytes
                    .set("spark.testing.memory", Config.SPARK_TESTING_MEMORY); // Set testing memory

            // Use Spark configuration to read CSV and create a relational DB
            try (JavaSparkContext sparkContext = new JavaSparkContext(sparkConf)) {
                SparkSession sparkSession = SparkSession.builder().appName(Config.SPARK_APP_NAME).getOrCreate();
                TSVReader tsvReader = new TSVReader();

                List<Dataset<Row>> datasets = new ArrayList<Dataset<Row>>();

                // Load CSV files into Spark datasets
                for (String file : files) {
                    datasets.add(tsvReader.readTSVFileIntoDataFrame(sparkSession, file));
                }

                // Configure JDBC connection properties
                // This is configured for tunneling via ssh, rather than direct-connect to the RDS instance
                String jdbcBaseUrl = Config.DATABASE_CONNECTION;
                String jdbcUsername = Config.DATABASE_USERNAME;
                String jdbcPassword = Config.DATABASE_PASSWORD;

                // Write DataFrames to RDS
                for (int i = 0; i < files.length; i++) {
                    String tableName = files[i].split("/")[1].split("\\.")[0];
                    writeDataFrameToRDS(datasets.get(i), tableName, jdbcBaseUrl, jdbcUsername, jdbcPassword);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static void writeDataFrameToRDS(Dataset<Row> dataframe, String tableName, String jdbcUrl, String jdbcUsername, String jdbcPassword) {
        try {
            // Write DataFrame to RDS
            dataframe.write()
                    .mode(SaveMode.Append)
                    .jdbc(jdbcUrl, tableName, getJdbcProperties(jdbcUsername, jdbcPassword));
        } catch (Exception e) {
            System.err.println("Error writing DataFrame to RDS for table " + tableName + ": " + e.getMessage());
        }
    }

    private static java.util.Properties getJdbcProperties(String username, String password) {
        java.util.Properties connectionProperties = new java.util.Properties();
        connectionProperties.setProperty("user", username);
        connectionProperties.setProperty("password", password);
        return connectionProperties;
    }
}
