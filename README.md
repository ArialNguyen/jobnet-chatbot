### Setting webhook
1. Update Page access_token in env file
2. Install zrok using by zrok: https://docs.zrok.io/docs/getting-started/
3. deploy: run 
```bash
zrok share public :3001
```
4. Update callback URL in Messenger API Settings
### Setting LLM
## Getting Started
First, pull docker image from DockerFile
```bash
docker-compose up -d ollama
```
