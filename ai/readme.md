# Shepherd's AI FastAPI Server

## Description

This repository contains a FastAPI server for Shepherd's AI app, which leverages streaming capabilities. The FastAPI server is designed to handle various tasks related to Shepherd's AI application, providing endpoints for data processing, authentication, and more.

## Features

- FastAPI server with streaming capabilities
- Dockerfiles for development and production environments
- Bash scripts for starting up the server in different environments

## Prerequisites

Before running the FastAPI server, ensure that you have the following installed:

- Docker
- Docker Compose

I would recommend [Orbstack](https://orbstack.dev), it's lightweight and requires only installation.

For API consumption I would recommend, [HTTPie](https://httpie.io).

> API calls must come with an X-Shepherd-Header.

## Getting Started

### Development Environment

To start the FastAPI server in the development environment, first fill in the environment variables:

```bash
cp .env.example .env
```

Then run the following command:

```bash
./start_dev.sh
```

This command will use Docker Compose to build the development Docker image and start the server. The server will be accessible at http://localhost:8000.

### Production Environment

To start the FastAPI server in the production environment, run the following command:

```bash
./start_prod.sh
```

This command will use Docker Compose to build the production Docker image and start the server. The server will be accessible at http://localhost:80.

## Note for macOS Users

If you encounter permission issues while running the bash scripts on macOS, you may need to give executable permissions to the scripts. You can do this by running the following commands:

```bash
chmod +x start_dev.sh start_prod.sh
```
