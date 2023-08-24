. ./config.sh

echo "—————— Logging into the EC2 Instance ———————"

ssh -i "$privateKeyPath" $awsUser@$hostname -o "StrictHostKeyChecking no" -tt << EOF
cd service
git pull git@github.com:vunderkind/shepherd-ai.git
npm i
npm run build
pm2 restart 0
exit
EOF

echo "———————— Logged out, deploy successful! ——————"