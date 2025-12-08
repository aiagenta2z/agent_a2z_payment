
```commandline
curl -v -X POST https://api-m.sandbox.paypal.com/v1/oauth2/token \
  -H "Accept: application/json" \
  -H "Accept-Language: en_US" \
  -u "<YOUR_CLIENT_ID>:<YOUR_SECRET>" \
  -d "grant_type=client_credentials"
  
```

