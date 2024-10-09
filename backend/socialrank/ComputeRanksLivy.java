package edu.upenn.cis.nets2120.socialrank;

import java.io.File;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintStream;
import java.io.PrintWriter;
import java.net.URISyntaxException;
import java.sql.PreparedStatement;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import edu.upenn.cis.nets2120.SparkJob;

import edu.upenn.cis.nets2120.ComputeRanks;
import scala.Tuple2;

/**
 * The `ComputeRanksLivy` class is responsible for running a social network ranking job using Apache Livy.
 * It takes command line arguments to configure the job parameters and performs the following tasks:
 * 1. Runs a SocialRankJob with backlinks set to true and writes the output to a file named "socialrank-livy-backlinks.csv".
 * 2. Runs a SocialRankJob with backlinks set to false and writes the output to a file named "socialrank-livy-nobacklinks.csv".
 * 3. Compares the top-10 results from both runs and writes the comparison to a file named "socialrank-livy-results.txt".
 * <p>
 * The class uses the Apache Livy library to submit and execute the jobs on a Livy server.
 * It also uses the SparkJob class to run the SocialRankJob and obtain the results.
 * <p>
 * To run the job, the `LIVY_HOST` environment variable must be set. If not set, the program will exit with an error message.
 */

public class ComputeRanksLivy {
    static Logger logger = LogManager.getLogger(ComputeRanksLivy.class);
    private static final String DB_URL = "jdbc:mysql://localhost:3306/socialmediadb";
    private static final String DB_USER = "admin";
    private static final String DB_PASSWORD = "rds-password";

    public static void main(String[] args) throws IOException, URISyntaxException, InterruptedException, ExecutionException {
        boolean debug;
        double d_max;
        int i_max;

        // Check so we'll fatally exit if the environment isn't set
        if (System.getenv("LIVY_HOST") == null) {
            logger.error("LIVY_HOST not set -- update your .env and run source .env");
            System.exit(-1);
        }

        d_max = 30;
        i_max = 25;
        debug = false;

        // Process command line arguments if given
        // if (args.length == 1) {
        //     d_max = Double.parseDouble(args[0]);
        //     i_max = 25;
        //     debug = false;
        // } else if (args.length == 2) {
        //     d_max = Double.parseDouble(args[0]);
        //     i_max = Integer.parseInt(args[1]);
        //     debug = false;
        // } else if (args.length == 3) {
        //     d_max = Double.parseDouble(args[0]);
        //     i_max = Integer.parseInt(args[1]);
        //     debug = true;
        // } else {
        //     d_max = 30;
        //     i_max = 25;
        //     debug = false;
        // }

        // Schedule the social rank computation task to run once per hour
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
        scheduler.scheduleAtFixedRate(() -> {
            try {
                // Clear the socialRank table before each computation
                clearSocialRankTable();

                // Compute the social rank
                String livy = SparkJob.getLivyUrl(args);
                SocialRankJob blJob = new SocialRankJob(d_max, i_max, 10, true, debug);
                List<MyPair<String, Double>> backlinksResult = SparkJob.runJob(livy, blJob);

                // Insert the social rank results into the database
                insertSocialRankResults(backlinksResult);

                logger.info("*** Finished social network ranking! ***");
            } catch (Exception e) {
                logger.error("Error computing social rank: " + e.getMessage());
            }
        }, 0, 1, TimeUnit.HOURS);
    }

    private static void clearSocialRankTable() {
        try (Connection connection = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD)) {
            String deleteQuery = "DELETE FROM socialRank";
            PreparedStatement statement = connection.prepareStatement(deleteQuery);
            statement.executeUpdate();
            logger.info("Cleared the socialRank table.");
        } catch (SQLException e) {
            logger.error("Error clearing the socialRank table: " + e.getMessage());
        }
    }

    private static void insertSocialRankResults(List<MyPair<String, Double>> backlinksResult) {
        try (Connection connection = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD)) {
            String insertQuery = "INSERT INTO socialRank (user_id, social_rank) VALUES (?, ?)";
            PreparedStatement statement = connection.prepareStatement(insertQuery);
            for (MyPair<String, Double> item : backlinksResult) {
                String userId = item.getLeft();
                double socialRank = item.getRight();
                statement.setString(1, userId);
                statement.setDouble(2, socialRank);
                statement.executeUpdate();
            }
            logger.info("Social rank results inserted into the database successfully!");
        } catch (SQLException e) {
            logger.error("Error inserting social rank results into the database: " + e.getMessage());
        }
    }
}