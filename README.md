### Setting chat widget with Hubspot
Nothing

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

5. Setting Compute server
### Setting ssh key
## Generate sshKey
https://doc.cocalc.com/compute_server.html#compute-server-filesystem    
# generate sshKey with rsa algorithms
```bash
ssh-keygen -t rsa -b 4096 -C "Hungnguyen100802@gmail.com"
```
# generate sshKey with ed25519 algorithms
```bash
ssh-keygen -t ed25519 -C "Hungnguyen100802@gmail.com"
```
## Connect to Localhost Compute Server --- Use this one
```bash
sudo su
```
# Rules
1. Can't not become root and sudo inside Project -> Must use in Root 
2. Root still inside Docker Container
# Connect to the host VM
```bash
ssh root@[server address]
```
# Connect to the Docker Container
```bash
ssh user@[server address]
```
# Forwarding Local Port to Ollama Service inside host VM:
```bash
ssh -L 11434:localhost:11434 root@[server address]
```