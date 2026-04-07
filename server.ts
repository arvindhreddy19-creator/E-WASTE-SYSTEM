import express from "express";
import cors from "cors";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Ensure uploads directory exists
  const uploadsDir = path.join(__dirname, "public", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Multer setup for image uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + "-" + file.originalname);
    },
  });
  const upload = multer({ storage });

  // Persistence setup
  const dataFilePath = path.join(__dirname, "data.json");
  
  const loadData = () => {
    if (fs.existsSync(dataFilePath)) {
      try {
        return JSON.parse(fs.readFileSync(dataFilePath, "utf8"));
      } catch (e) {
        console.error("Error loading data:", e);
      }
    }
    return {
      users: [
        { id: "admin", password: "123", role: "authority", name: "System Admin", status: "active", wallet: 0 },
        { id: "collector1", password: "123", role: "collector", name: "John Collector", status: "active", wallet: 0 },
        { id: "recycler1", password: "123", role: "recycler", name: "Green Recyclers", status: "active", wallet: 0 },
        { id: "user1", password: "123", role: "user", name: "Alice User", wallet: 0, status: "active" },
      ],
      requests: [],
      complaints: [],
      notifications: [
        { id: 1, title: "Welcome to E-Waste Tracker", message: "Start recycling today and earn rewards!", date: new Date().toISOString() }
      ],
      collectorLocations: {
        collector1: { lat: 12.9716, lng: 77.5946 },
      }
    };
  };

  const saveData = (data: any) => {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
  };

  let appData = loadData();
  const users = appData.users;
  const requests = appData.requests;
  const complaints = appData.complaints;
  const notifications = appData.notifications;
  const collectorLocations = appData.collectorLocations;

  // Helper to save current state
  const sync = () => saveData({ users, requests, complaints, notifications, collectorLocations });

  // API Endpoints
  app.post("/api/login", (req, res) => {
    const { id, password } = req.body;
    const user = users.find((u: any) => u.id === id && u.password === password);
    if (user) {
      if (user.status === "blocked") {
        return res.status(403).json({ message: "Account is suspended." });
      }
      res.json({ user });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  });

  app.post("/api/register", (req, res) => {
    const { id, password, name } = req.body;
    if (users.find((u: any) => u.id === id)) {
      return res.status(400).json({ message: "User ID already exists" });
    }
    const newUser = { id, password, name, role: "user", wallet: 0, status: "active" };
    users.push(newUser);
    sync();
    res.json({ user: newUser });
  });

  app.post("/api/requests", upload.single("image"), (req, res) => {
    const { userId, type, quantity, lat, lng } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    
    const newRequest = {
      id: "REQ" + Date.now(),
      userId,
      type,
      quantity: parseFloat(quantity),
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      image,
      status: "Pending",
      collectorId: null,
      price: 0,
      disposalMethod: null,
      disposalDate: null,
      timestamp: new Date().toISOString(),
    };
    
    requests.push(newRequest);
    sync();
    res.json({ request: newRequest });
  });

  app.get("/api/requests", (req, res) => {
    const { role, userId } = req.query;
    if (role === "user") {
      return res.json(requests.filter((r: any) => r.userId === userId));
    } else if (role === "collector") {
      return res.json(requests.filter((r: any) => r.status === "Pending" || r.collectorId === userId));
    } else if (role === "authority" || role === "recycler") {
      return res.json(requests);
    }
    res.status(400).json({ message: "Invalid role" });
  });

  app.post("/api/requests/:id/status", (req, res) => {
    const { id } = req.params;
    const { status, collectorId, price, disposalMethod } = req.body;
    
    const request = requests.find((r: any) => r.id === id);
    if (!request) return res.status(404).json({ message: "Request not found" });
    
    if (status) request.status = status;
    if (collectorId) request.collectorId = collectorId;
    if (disposalMethod) {
      request.disposalMethod = disposalMethod;
      request.disposalDate = new Date().toISOString();
    }
    if (price !== undefined) {
      request.price = parseFloat(price);
      if (status === "Completed") {
        const user = users.find((u: any) => u.id === request.userId);
        if (user) {
          user.wallet = (user.wallet || 0) + request.price * 0.5;
        }
      }
    }
    sync();
    res.json({ request });
  });

  app.get("/api/analytics", (req, res) => {
    const totalWaste = requests.reduce((sum: number, r: any) => sum + r.quantity, 0);
    const totalRevenue = requests.reduce((sum: number, r: any) => sum + (r.price || 0), 0);
    const totalRewards = totalRevenue * 0.5;
    
    const dayWise: any = {};
    requests.forEach((r: any) => {
      const day = r.timestamp.split("T")[0];
      dayWise[day] = (dayWise[day] || 0) + r.quantity;
    });
    
    const monthWise: any = {};
    requests.forEach((r: any) => {
      const month = r.timestamp.substring(0, 7);
      monthWise[month] = (monthWise[month] || 0) + r.quantity;
    });

    const disposalStats: any = {
      'Material Recovery': 0,
      'Energy Recovery': 0,
      'Safe Disposal': 0,
      'Pending': 0
    };
    requests.forEach((r: any) => {
      if (r.disposalMethod) {
        disposalStats[r.disposalMethod] = (disposalStats[r.disposalMethod] || 0) + r.quantity;
      } else if (r.status !== 'Completed') {
        disposalStats['Pending'] = (disposalStats['Pending'] || 0) + r.quantity;
      }
    });

    // Efficiency & Environmental Impact
    const completedRequests = requests.filter((r: any) => r.status === 'Completed');
    const efficiency = requests.length > 0 ? (completedRequests.length / requests.length) * 100 : 0;
    
    // Environmental metrics (simulated)
    // 1kg e-waste recycled saves ~1.5kg CO2
    const co2Saved = completedRequests.reduce((sum: number, r: any) => sum + r.quantity * 1.5, 0);
    // 1kg e-waste contains ~0.1g gold, ~100g copper etc.
    const materialsRecovered = {
      copper: completedRequests.reduce((sum: number, r: any) => sum + r.quantity * 0.1, 0), // 10% copper
      plastic: completedRequests.reduce((sum: number, r: any) => sum + r.quantity * 0.3, 0), // 30% plastic
      glass: completedRequests.reduce((sum: number, r: any) => sum + r.quantity * 0.2, 0), // 20% glass
    };

    // High Waste Areas (based on lat/lng)
    const areas: any = {};
    requests.forEach((r: any) => {
      if (r.lat && r.lng) {
        const key = `${r.lat.toFixed(2)},${r.lng.toFixed(2)}`;
        areas[key] = (areas[key] || 0) + r.quantity;
      }
    });
    const highWasteAreas = Object.entries(areas).map(([coord, qty]) => ({ coord, qty: qty as number }))
      .sort((a, b) => b.qty - a.qty).slice(0, 5);
    
    res.json({ 
      totalWaste, totalRevenue, totalRewards, dayWise, monthWise, disposalStats,
      efficiency, co2Saved, materialsRecovered, highWasteAreas
    });
  });

  app.get("/api/users", (req, res) => {
    res.json(users);
  });

  app.post("/api/users/:id/action", (req, res) => {
    const { id } = req.params;
    const { action } = req.body;
    const userIndex = users.findIndex((u: any) => u.id === id);
    if (userIndex === -1) return res.status(404).json({ message: "User not found" });
    if (action === "block") users[userIndex].status = "blocked";
    else if (action === "unblock") users[userIndex].status = "active";
    else if (action === "delete") users.splice(userIndex, 1);
    sync();
    res.json({ message: "Action successful" });
  });

  app.post("/api/location", (req, res) => {
    const { collectorId, lat, lng } = req.body;
    collectorLocations[collectorId] = { lat, lng };
    sync();
    res.json({ message: "Location updated" });
  });

  app.get("/api/location/:collectorId", (req, res) => {
    const { collectorId } = req.params;
    res.json(collectorLocations[collectorId] || { lat: 0, lng: 0 });
  });

  // Complaints
  app.post("/api/complaints", (req, res) => {
    const { userId, role, subject, message } = req.body;
    const complaint = {
      id: Date.now(),
      userId,
      role,
      subject,
      message,
      status: 'Open',
      date: new Date().toISOString()
    };
    complaints.push(complaint);
    sync();
    res.json(complaint);
  });

  app.get("/api/complaints", (req, res) => {
    res.json(complaints);
  });

  app.post("/api/complaints/:id/resolve", (req, res) => {
    const { id } = req.params;
    const complaint = complaints.find((c: any) => c.id === parseInt(id));
    if (complaint) {
      complaint.status = 'Resolved';
      sync();
    }
    res.json({ message: "Resolved" });
  });

  // Notifications
  app.post("/api/notifications", (req, res) => {
    const { title, message } = req.body;
    const notification = {
      id: Date.now(),
      title,
      message,
      date: new Date().toISOString()
    };
    notifications.push(notification);
    sync();
    res.json(notification);
  });

  app.get("/api/notifications", (req, res) => {
    res.json(notifications);
  });

  // Dataset Import
  app.post("/api/import", (req, res) => {
    const { data } = req.body;
    let importCount = 0;
    if (Array.isArray(data)) {
      data.forEach((item: any) => {
        // Heuristic to identify user
        const isUser = item.type === 'user' || (item.role && item.password && item.id);
        // Heuristic to identify request
        const isRequest = item.type === 'request' || (item.userId && item.quantity && !item.role);

        if (isRequest) {
          const newReq = {
            id: item.id || "REQ" + Math.random().toString(36).substr(2, 9),
            userId: item.userId,
            type: item.wasteType || item.type || 'unknown',
            quantity: parseFloat(item.quantity) || 0,
            lat: item.lat ? parseFloat(item.lat) : (12.9 + Math.random() * 0.1),
            lng: item.lng ? parseFloat(item.lng) : (77.5 + Math.random() * 0.1),
            image: item.image || null,
            status: item.status || "Pending",
            collectorId: item.collectorId || null,
            price: parseFloat(item.price) || 0,
            disposalMethod: item.disposalMethod || null,
            disposalDate: item.disposalDate || null,
            timestamp: item.timestamp || new Date().toISOString()
          };
          requests.push(newReq);
          importCount++;
        } else if (isUser) {
          if (!users.find((u: any) => u.id === item.id)) {
            users.push({ 
              id: item.id,
              password: item.password || "123",
              name: item.name || item.id,
              role: item.role || "user",
              status: item.status || "active",
              wallet: parseFloat(item.wallet) || 0 
            });
            importCount++;
          }
        }
      });
      sync();
      res.json({ message: "Import successful", count: importCount });
    } else {
      res.status(400).json({ message: "Invalid data format" });
    }
  });

  // Serve uploads
  app.use("/uploads", express.static(uploadsDir));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
