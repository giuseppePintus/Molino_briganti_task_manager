🔄 FIXED DEPLOYMENT INSTRUCTIONS FOR NAS

The issue was that the docker-compose.yml was using /data/molino which doesn't exist on the NAS.
I've now updated it to use ../molino-data which maps to your existing ~/molino-data directory.

NEW TAR FILE is ready at:
c:\Users\manue\Molino_briganti_task_manager\task-manager-app\molino-task-manager-latest.tar

STEP-BY-STEP (run these commands in your NAS SSH terminal, one at a time):

1. Go to app directory:
   cd ~/molino-app

2. Check that molino-data and molino-backups directories exist:
   ls -la ~/ | grep molino

3. Load the new Docker image:
   docker load -i molino-task-manager-latest.tar

4. Stop and remove old containers:
   docker-compose down

5. Start new containers with fixed paths:
   docker-compose up -d

6. Wait a few seconds for startup:
   sleep 5

7. Check that everything started properly:
   docker logs molino-briganti-task-manager | tail -30

8. You should see messages like:
   ✅ Database connected successfully
   ✅ Database tables created successfully
   ✅ Server is running on port 5000

9. Now test the import in your browser:
   - Go to http://192.168.1.248:5000
   - Login: Manuel / 123
   - Go to warehouse-management.html
   - Click "Importa Articoli da CSV"
   - Select inventory_data.csv
   - Should see success with imported articles count

If you see errors with "column 'reserved' does not exist", the problem is still the database.
Run this to force migrations: docker exec molino-briganti-task-manager npx prisma db push --skip-generate

WHAT WAS FIXED:
- Rebuilt with enhanced error logging
- Fixed docker-compose.yml to use existing ~/molino-data and ~/molino-backups directories
- Added better error reporting in importInventoryFromCSV service
- Ensured all data types are properly converted before Prisma operations
