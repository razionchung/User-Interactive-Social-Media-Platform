# Dataset Loader Setup Guide

We will walk you through the steps to load the (truncated) relational movies database into an Amazon
RDS (MySQL) database. Amazon RDS is a managed service that simplifies setting up, operating, and
scaling a relational database in the cloud. For security reasons, the RDS instance is not publicly
accessible and can only be reached within
a [Virtual Private Cloud](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html)
(VPC) on Amazon. We circumvent this by setting up an EC2 instance within the same VPC to forward
requests from your local machine through an SSH tunnel.

Since we are using AWS Academy, **you will need to create the EC2 Nano instance every 4 hours** when
your session expires. Hence, some of the steps will need to be repeated every session.

## Initial Setup

### Create Your RDS Database (One-time setup)

1. Navigate to the AWS Console and select RDS.
2. Go to **Databases** > **Create Database**.
3. Choose the **MySQL** engine and select the **Free Tier** option.
4. Name your database `imdbdatabase`.
5. Set the administrative user name to `admin` and password to `rds-password`, or use any combo you
   prefer.

### Create an EC2 Nano Instance (Required every session)

We'll launch the tiniest EC2 instance we can, because it is just going to be used as a forwarding
service.

1. In the AWS Console, go to **EC2** > **Instances** > **Launch Instances**.
2. Name the instance `Tunnel`.
3. Choose **Ubuntu** from the Application and OS Images Quick Start.
4. Under **Instance Type**, select **t2.nano**.
5. Create a new key pair named `tunnel`. Ensure it is RSA and in pem format. Download this key pair.
   If one already exists, you don't need to do this step again.

### Prepare the SSH Key Pair (One-time setup)

1. In your host OS (macOS, Windows, Linux), copy the `tunnel.pem` file to your shared `nets2120`
   directory (right alongside the various homework subdirectories).
2. Log into your Docker container terminal (e.g., via `docker exec -it nets2120 bash` or the Docker
   Desktop UI or in VSCode) and go into your `nets2120` directory.
3. Move the file into the default SSH location:
    ```bash 
    mv tunnel.pem ~/.ssh
    ```
4. Set permissions:
    ```bash
    chmod 600 ~/.ssh/tunnel.pem
    ```

## Configuration Steps

### Linking RDS and EC2 Instances (Required every session)

Now we need to make sure your RDS and EC2 tunnel servers are in the *same* Virtual Private Cloud.

1. From the EC2 Dashboard in the AWS Console, navigate to your `Tunnel` instance's details.
2. Under **Actions** > **Networking**, select **Connect RDS Database**. Choose **Instance**, then
   select your RDS database from the list.

### Setting Up the SSH Tunnel (Required every session)

You'll need to collect two hostnames:

1. The name of your RDS server, e.g., `database-2.czkkqa8wuy3r.us-east-1.rds.amazonaws.com`
2. The name of your EC2 Nano tunnel server, e.g., `ec2-3-86-71-131.compute-1.amazonaws.com`

Run the SSH command to establish the tunnel:

```bash
ssh -i ~/.ssh/tunnel.pem -4 -L 3306:<RDS_Hostname>:3306 ubuntu@<EC2_Hostname>
```

Replace `<RDS_Hostname>` and `<EC2_Hostname>` with your specific hostnames.

As an example, with respect to our test instances, we ran:

```bash
ssh -i ~/.ssh/tunnel.pem -4 -L 3306:imdbdatabase.czkkqa8wuy3r.us-east-1.rds.amazonaws.com:3306 ubuntu@ec2-3-86-71-131.compute-1.amazonaws.com
```

**Note**: On first connection, answer `yes` to confirm trust for the server. You'll be logged into
an Amazon EC2 node at this point. Keep the terminal with the SSH session open to maintain the
tunnel.

Until `ssh` exits, you'll have a "tunnel" set up so requests in your container for `localhost`
port `3306` get redirected to the tunnel server; then it makes requests to the database server on
your behalf. Leave this terminal open until you are done. Meanwhile, you'll want to create a new
terminal connection (e.g., via `docker exec -it nets2120 bash`) to do your remaining work.

### Create the Database (One-time setup)

- Install MySQL client on EC2 with `sudo apt update` and `sudo apt install mysql-client-core-8.0`.
- Log into your RDS instance and create the database `imdbdatabase`:
    ```bash
    mysql --host=<RDS_Hostname> --user=admin --password=rds-password
    create database imdbdatabase;
    exit
    ```

Replace the host, user, and password with your specific RDS instance details.

## Running the DataLoader

With the tunnel set up,
the [DataLoader](src/main/java/org/nets2120/imdbSocialNetwork/DataLoader.java) application will
connect to `localhost:3306`, which redirects to the RDS server. The loader uses built-in
capabilities from Apache Spark to create tables in SQL.

To run the loader:

1. Open a new Docker terminal session while keeping the SSH tunnel active.
2. Navigate to the directory
   containing [`DataLoader.java`](src/main/java/org/nets2120/imdbSocialNetwork/DataLoader.java).
3. Execute the following Maven commands:
    ```bash
    mvn clean
    mvn compile
    mvn exec:java@loader
    ```

This setup will enable your DataLoader to communicate with the Amazon RDS database through the
established SSH tunnel.
