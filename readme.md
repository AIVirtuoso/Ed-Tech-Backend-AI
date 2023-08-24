# WIP


## Set uo
This project depends on two key Docker images: 
1. Milvus (for vector semantic search)
2. Unstructured (for document extraction, chunking and sentence transformation)

Run `docker-compose -f docker-compose.yml up -d` to set them up. Note that this might take a while.
## Vector Database

We use `Milvus` as a vector store, and for retrieval augmentation.
Check the status of the Milvus store by running:
```bash
docker port milvus-standalone 19530/tcp
````
An echo of 0.0.0.0:19530 confirms Milvus is running and exposed on localhost:19530.