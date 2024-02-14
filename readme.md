## TL;DR
The Shepherd AI service runs on an AWS EC2 instance supported by PM2 (for app restart on crash) and an nginx load balancer.

It exposes its services through API endpoints (powered by Express, typically for returning structured payloads such as chat history, response objects, and flashcard JSONs) and Socket.io ( for real-time communication between the AI chatbot and the end-user — also for streaming responses on a per-token basis.)

The AI's memory is powered by a vector database (Pinecone, though any vector db will do — Pinecone was a matter of convenience, as they're plug-and-play. Other engineers have told me Pinecone might end up costing more in the long-term, so keep an eye on that! I attempted to port us over to Milvus, and made a lot of progress until I realized it broke whenever I tried to scale it up. Turns out Milvus hasn't been vetted production-ready yet. This is why I should read docs before going off on a tangent.)

Everything else is stored on Postgres (chat history, document payloads, that sort of thing). 

At the bottom of this document is a list of logins I have access to, but the GitHub repository I'll hand over to you has all the configuration you need to run the service — in the `development.json` file in the `config` folder at the root of the project. 

## Pre-launch checklist
1. Switch to a Postgres database owned by Shepherd. The current one is hosted on Supabase and linked to my personal account. 
2. Switch to a production-grade Pinecone subscription. The current collection is small, has no redundancy, and gets deleted after 7 days of inactivity. Great for testing, but not what we want to launch with. The `config/development.json` file makes it easy to swap out configs and get things up to speed. 
3. Prompts used can be found in the `helpers/promptTemplates` folder. I should mention that I have some prompts deep within the sockets, so it's worth looking at those as well. I forgot to refactor them back into the prompts central folder. 
4. So far I've avoided creating db  `migrations` as they're a pain in the ass, but eventually they're going to be necessary. Until then, I have left functions with titles starting at `sync...` at the bottom of the Sequelize Model definitions. Uncommenting them out WILL NUKE THE DB AND REBUILD IT. This is great for testing and development, but is a cardinal sin once things go live. Please remove them and use migrations as soon as go-to-prod is green!
5. Consider containerizing this project. If I had downtime, this is something I'd have loved to explore: containerizing it and deploying with ECS. 

## About the EC2 instance
I don't know if either of you have worked with EC2 before (and it was certainly my first time with Shepherd), but I attached the ai-service-key.pem file and you can see two bash scripts in the `/scripts` folder. The bash scripts contain a rudimentary way to automate deploys. Again, ECS via Docker is a more robust way. I eventually migrated over to GitHub actions, but they're connected to my account, so I'm happy to spend some time with anyone interested to have the deploy pipeline set up on the official Shepherd GitHub account, once the zipped file is hosted successfully. 

## Miscellaneous
There are definitely things I omitted that may present a hurdle once you take over the service, especially wrt 

## Logins

**AWS**
Email: hello@shepherdtutors.com
Password: Fibonacci3.142@@@

**Accounts you must create**
1. Pinecone
2. A Postgres account (I tried with RDS but it was too expensive — though in retrospect, the issue was that I was using a way-too-managed RDS setup. Then again, all the boon of RDS is in the management, right?)

## Stuff to read
1. https://python.langchain.com/docs/modules/data_connection/retrievers/parent_document_retriever
2. Enhanced QA Search — https://arxiv.org/pdf/2210.10584.pdf
3. Summarization chain — https://js.langchain.com/docs/modules/chains/popular/summarize
4. Explore MapReduce for `generate-from-notes` for flash-cards.