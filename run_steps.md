# Running EnviroCheck

## Current Environment Status
- **Node.js**: v22.20.0 (Available)
- **npm**: 10.9.3 (Available)
- **MongoDB**: Service not found (Using fallback mode)
- **Python**: Shortcut found (Might be Windows Store shim)

## Proposed Steps

1. **Start Backend Server**
   - Location: `server/`
   - Command: `npm run dev`
   - Port: 5000

2. **Start ML Service**
   - Location: `ml-service/`
   - Command: `python main.py` (Verify installation first)
   - Port: 8000

3. **Start Frontend Client**
   - Location: `client/`
   - Command: `npm run dev`
   - Port: 5173

## Execution Commands
- Start Backend: `cd server; npm run dev`
- Start ML Service: `cd ml-service; python main.py`
- Start Frontend: `cd client; npm run dev`
