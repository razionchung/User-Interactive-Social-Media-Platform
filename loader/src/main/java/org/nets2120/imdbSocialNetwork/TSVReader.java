package org.nets2120.imdbSocialNetwork;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;

public class TSVReader {
    public Dataset<Row> readTSVFileIntoDataFrame(SparkSession sparkSession, String filePath) {
        return sparkSession.read()
                .option("delimiter", "\t")  // Specify tab as the delimiter
                .option("header", "true")
                .csv(filePath);
    }
}
