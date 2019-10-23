# homebridge-canary
Homebridge plugin for Canary

## Installation
`sudo npm install -g --unsafe-perm homebridge-canary`

## Configuration
Add to the accessories in your `config.json`
```
{
  "name": "Canary",
  "accessory": "Canary",
  "model": "AllInOne|Flex",
  "serial": "<serial>",
  "username": "<username>",
  "password": "<password>",
  "pollingInterval": 300
}
```
