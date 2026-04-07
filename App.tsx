import React, { useState, useEffect, useRef } from 'react';
import { 
  Recycle, 
  Lock, 
  User as UserIcon, 
  Truck, 
  History, 
  Wallet, 
  PlusCircle, 
  MapPin, 
  X, 
  Loader, 
  List, 
  Users as UsersIcon, 
  Search, 
  ExternalLink,
  Factory,
  Navigation,
  Map as MapIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import Papa from 'papaparse';

// --- Types ---
type Role = 'user' | 'collector' | 'authority' | 'recycler';

interface User {
  id: string;
  name: string;
  role: Role;
  wallet: number;
  status: 'active' | 'blocked';
}

interface ERequest {
  id: string;
  userId: string;
  type: string;
  quantity: number;
  lat: number | null;
  lng: number | null;
  image: string | null;
  status: string;
  collectorId: string | null;
  price: number;
  disposalMethod: string | null;
  disposalDate: string | null;
  timestamp: string;
}

interface Analytics {
  totalWaste: number;
  totalRevenue: number;
  totalRewards: number;
  dayWise: Record<string, number>;
  monthWise: Record<string, number>;
  disposalStats: Record<string, number>;
  efficiency: number;
  co2Saved: number;
  materialsRecovered: {
    copper: number;
    plastic: number;
    glass: number;
  };
  highWasteAreas: { coord: string; qty: number }[];
}

interface Complaint {
  id: number;
  userId: string;
  role: string;
  subject: string;
  message: string;
  status: 'Open' | 'Resolved';
  date: string;
}

interface Notification {
  id: number;
  title: string;
  message: string;
  date: string;
}

// --- Constants ---
const RATES: Record<string, number> = {
  mobile: 500,
  laptop: 2000,
  battery: 100,
};

const STATUS_COLORS: Record<string, string> = {
  'Pending': 'bg-yellow-100 text-yellow-700',
  'Collected': 'bg-blue-100 text-blue-700',
  'Sent to Authority': 'bg-purple-100 text-purple-700',
  'Sent to Recycler': 'bg-indigo-100 text-indigo-700',
  'Evaluated': 'bg-orange-100 text-orange-700',
  'Completed': 'bg-green-100 text-green-700',
};

// --- App Component ---
export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [requests, setRequests] = useState<ERequest[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [aiSearchResults, setAiSearchResults] = useState<{ text: string; sources: any[] } | null>(null);
  const [aiSearching, setAiSearching] = useState(false);

  // Splash Screen Effect
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch Data when user changes
  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/requests?role=${user.role}&userId=${user.id}`);
      const data = await res.json();
      setRequests(data);

      const [nRes, cRes] = await Promise.all([
        fetch('/api/notifications'),
        fetch('/api/complaints')
      ]);
      setNotifications(await nRes.json());
      setComplaints(await cRes.json());

      if (user.role === 'authority') {
        const [aRes, uRes] = await Promise.all([
          fetch('/api/analytics'),
          fetch('/api/users')
        ]);
        setAnalytics(await aRes.json());
        setAllUsers(await uRes.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- Auth Handlers ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as any;
    const id = form.id.value;
    const password = form.password.value;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as any;
    const name = form.name.value;
    const id = form.id.value;
    const password = form.password.value;

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password, name })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const logout = () => {
    setUser(null);
    setRequests([]);
    setAnalytics(null);
    setComplaints([]);
    setNotifications([]);
  };

  // --- Request Handlers ---
  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const form = e.target as any;
    const formData = new FormData();
    formData.append('userId', user.id);
    formData.append('type', form.type.value);
    formData.append('quantity', form.quantity.value);
    formData.append('image', form.image.files[0]);
    
    // Simulate location
    const lat = 12.9 + Math.random() * 0.1;
    const lng = 77.5 + Math.random() * 0.1;
    formData.append('lat', lat.toString());
    formData.append('lng', lng.toString());

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        alert('Pickup request submitted successfully!');
        loadDashboardData();
        form.reset();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- Complaint Handlers ---
  const submitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const form = e.target as any;
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          role: user.role,
          subject: form.subject.value,
          message: form.message.value
        })
      });
      if (res.ok) {
        alert('Complaint submitted successfully');
        loadDashboardData();
        form.reset();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resolveComplaint = async (id: number) => {
    try {
      const res = await fetch(`/api/complaints/${id}/resolve`, { method: 'POST' });
      if (res.ok) loadDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  // --- Notification Handlers ---
  const postNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as any;
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.value,
          message: form.message.value
        })
      });
      if (res.ok) {
        alert('Notification posted');
        loadDashboardData();
        form.reset();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- Dataset Import ---
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      let data: any[] = [];
      const fileName = file.name.toLowerCase();
      try {
        if (fileName.endsWith('.json')) {
          data = JSON.parse(event.target?.result as string);
        } else if (fileName.endsWith('.csv')) {
          const result = Papa.parse(event.target?.result as string, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true
          });
          data = result.data;
        } else {
          throw new Error('Unsupported file format. Please use .json or .csv');
        }

        if (!data || (Array.isArray(data) && data.length === 0)) {
          throw new Error('No data found in the file');
        }

        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data })
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'Server error during import');
        }

        const result = await res.json();
        alert(result.message + " (" + result.count + " items)");
        loadDashboardData();
      } catch (err: any) {
        alert('Import failed: ' + err.message);
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const updateStatus = async (id: string, status: string, collectorId: string | null = null) => {
    try {
      const res = await fetch(`/api/requests/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, collectorId })
      });
      if (res.ok) {
        loadDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const evaluateRequest = async (id: string, price: string, disposalMethod: string) => {
    if (!price) return alert('Please enter price');
    if (!disposalMethod) return alert('Please select a disposal method');
    try {
      const res = await fetch(`/api/requests/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Completed', price, disposalMethod })
      });
      if (res.ok) {
        alert(`Evaluation completed. ₹${(parseFloat(price) * 0.5).toFixed(2)} credited to user.`);
        loadDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const manageUser = async (id: string, action: string) => {
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    try {
      const res = await fetch(`/api/users/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        loadDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- AI Search Handler ---
  const handleAiSearch = async () => {
    if (!aiSearchQuery) return;
    setAiSearching(true);
    setAiSearchResults(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: aiSearchQuery,
        config: {
          tools: [{ googleMaps: {} }],
        },
      });

      const text = response.text;
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources = chunks ? chunks.map((c: any) => ({
        uri: c.maps?.uri,
        title: c.maps?.title
      })).filter((s: any) => s.uri) : [];

      setAiSearchResults({ text, sources });
    } catch (err) {
      console.error(err);
      alert('AI search failed. Please check your API key.');
    } finally {
      setAiSearching(false);
    }
  };

  // --- Tracking Modal ---
  const openTracking = (collectorId: string) => {
    setModalContent(<TrackingMap collectorId={collectorId} />);
  };

  const openDetails = (req: ERequest) => {
    setModalContent(
      <div className="space-y-4">
        <h2 className="text-2xl font-bold mb-4">Request Details</h2>
        {req.image && <img src={req.image} className="w-full h-64 object-cover rounded-xl shadow-md" />}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">Request ID</p>
            <p className="font-mono">{req.id}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">Status</p>
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[req.status]}`}>{req.status}</span>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">Type</p>
            <p className="capitalize">{req.type}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">Quantity</p>
            <p>{req.quantity} kg</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">User ID</p>
            <p>{req.userId}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">Date</p>
            <p>{new Date(req.timestamp).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    );
  };

  // --- Render Helpers ---
  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-green-600 flex flex-col items-center justify-center z-50">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="bg-white p-8 rounded-full shadow-2xl"
        >
          <Recycle className="w-24 h-24 text-green-600" />
        </motion.div>
        <h1 className="text-white text-3xl font-bold mt-8 tracking-wider">Smart E-Waste System</h1>
        <p className="text-green-100 mt-2">Incentivizing a Greener Future</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans">
      {/* Navigation */}
      <nav className="bg-white shadow-md px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Recycle className="text-green-600 w-8 h-8" />
          <span className="text-xl font-bold text-gray-800">Smart E-Waste</span>
        </div>
        {user && (
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="font-semibold text-gray-700">{user.name}</p>
              <p className="text-xs text-gray-500 uppercase tracking-widest">{user.role}</p>
            </div>
            <button onClick={logout} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition">Logout</button>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-grow p-6 max-w-7xl mx-auto w-full">
        {!user ? (
          <div className="flex items-center justify-center h-full py-12">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
              <div className="flex justify-center mb-6">
                <div className="bg-green-100 p-4 rounded-full">
                  <Lock className="text-green-600 w-8 h-8" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">
                {isRegistering ? 'Create Account' : 'Welcome Back'}
              </h2>
              
              {!isRegistering ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                    <input name="id" type="text" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input name="password" type="password" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                  <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition transform hover:scale-[1.02]">Login</button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input name="name" type="text" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                    <input name="id" type="text" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input name="password" type="password" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                  <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition transform hover:scale-[1.02]">Register</button>
                </form>
              )}

              <div className="mt-6 text-center">
                <button 
                  onClick={() => setIsRegistering(!isRegistering)} 
                  className="text-green-600 hover:underline text-sm font-medium"
                >
                  {isRegistering ? 'Already have an account? Login' : 'New user? Register here'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {loading ? (
              <div className="text-center py-12"><Loader className="animate-spin w-12 h-12 text-green-600 mx-auto" /></div>
            ) : (
              <>
                {user.role === 'user' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-8">
                      <div className="bg-white p-6 rounded-2xl shadow-lg">
                        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                          <PlusCircle className="mr-2 text-green-600" /> New Pickup Request
                        </h3>
                        <form onSubmit={submitRequest} className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">E-Waste Type</label>
                            <select name="type" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none">
                              <option value="mobile">Mobile Phone (Est. ₹500)</option>
                              <option value="laptop">Laptop (Est. ₹2000)</option>
                              <option value="battery">Battery (Est. ₹100)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (in kg)</label>
                            <input name="quantity" type="number" step="0.1" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Upload Image</label>
                            <input name="image" type="file" accept="image/*" required className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                          </div>
                          <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition">Submit Request</button>
                        </form>
                      </div>

                      <div className="bg-white p-6 rounded-2xl shadow-lg">
                        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                          <Navigation className="mr-2 text-blue-600" /> Public Awareness
                        </h3>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto">
                          {notifications.map(n => (
                            <div key={n.id} className="bg-blue-50 p-4 rounded-xl border-l-4 border-blue-500">
                              <h4 className="font-bold text-blue-800 text-sm">{n.title}</h4>
                              <p className="text-xs text-blue-600 mt-1">{n.message}</p>
                              <p className="text-[10px] text-blue-400 mt-2">{new Date(n.date).toLocaleDateString()}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-2 space-y-8">
                      <div className="bg-gradient-to-r from-green-600 to-green-500 p-6 rounded-2xl shadow-lg text-white flex justify-between items-center">
                        <div>
                          <p className="text-green-100 text-sm font-medium uppercase tracking-wider">Wallet Balance</p>
                          <h2 className="text-4xl font-bold mt-1">₹{user.wallet.toFixed(2)}</h2>
                        </div>
                        <div className="bg-white/20 p-4 rounded-full"><Wallet className="w-10 h-10" /></div>
                      </div>
                      
                      <div className="bg-white p-6 rounded-2xl shadow-lg">
                        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center"><History className="mr-2 text-green-600" /> Pickup History</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="text-gray-400 text-sm border-b">
                                <th className="pb-3 font-medium">ID</th>
                                <th className="pb-3 font-medium">Type</th>
                                <th className="pb-3 font-medium">Qty</th>
                                <th className="pb-3 font-medium">Status</th>
                                <th className="pb-3 font-medium">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {requests.map(r => (
                                <tr key={r.id} className="text-sm">
                                  <td className="py-4 font-mono">{r.id}</td>
                                  <td className="py-4 capitalize">{r.type}</td>
                                  <td className="py-4">{r.quantity} kg</td>
                                  <td className="py-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                                  </td>
                                  <td className="py-4">
                                    {(r.status === 'Collected' || r.status === 'Sent to Authority') && r.collectorId ? (
                                      <button onClick={() => openTracking(r.collectorId!)} className="text-green-600 hover:underline flex items-center">
                                        <MapPin className="w-4 h-4 mr-1" /> Track
                                      </button>
                                    ) : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl shadow-lg">
                        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center"><List className="mr-2 text-red-600" /> Submit Complaint</h3>
                        <form onSubmit={submitComplaint} className="space-y-4">
                          <input name="subject" placeholder="Subject" required className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-red-500" />
                          <textarea name="message" placeholder="Describe your issue..." required className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 h-24"></textarea>
                          <button type="submit" className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700 transition">Submit</button>
                        </form>
                      </div>
                    </div>
                  </div>
                )}

                {user.role === 'collector' && (
                  <div className="space-y-8">
                    <div className="bg-white p-6 rounded-2xl shadow-lg">
                      <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center"><Truck className="mr-2 text-green-600" /> Assigned Pickups</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {requests.map(r => (
                          <div key={r.id} className="border rounded-xl p-4 space-y-4 hover:shadow-md transition">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-xs text-gray-400 font-mono">{r.id}</p>
                                <h4 className="font-bold text-gray-800 capitalize">{r.type} - {r.quantity}kg</h4>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                            </div>
                            {r.image && <img src={r.image} className="w-full h-32 object-cover rounded-lg" />}
                            <div className="pt-2 border-t">
                              {r.status === 'Pending' ? (
                                <button onClick={() => updateStatus(r.id, 'Collected', user.id)} className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-bold">Mark as Collected</button>
                              ) : r.status === 'Collected' ? (
                                <button onClick={() => updateStatus(r.id, 'Sent to Authority')} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-bold">Send to Authority</button>
                              ) : <p className="text-center text-xs text-gray-400 italic">Action completed</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-lg">
                      <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center"><List className="mr-2 text-red-600" /> Submit Complaint</h3>
                      <form onSubmit={submitComplaint} className="space-y-4">
                        <input name="subject" placeholder="Subject" required className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-red-500" />
                        <textarea name="message" placeholder="Describe your issue..." required className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 h-24"></textarea>
                        <button type="submit" className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700 transition">Submit</button>
                      </form>
                    </div>
                    <CollectorLocationUpdater collectorId={user.id} />
                  </div>
                )}

                {user.role === 'authority' && analytics && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <StatCard title="Total E-Waste" value={`${analytics.totalWaste.toFixed(1)} kg`} color="border-green-500" />
                      <StatCard title="Recycling Efficiency" value={`${analytics.efficiency.toFixed(1)}%`} color="border-blue-500" />
                      <StatCard title="CO2 Saved" value={`${analytics.co2Saved.toFixed(1)} kg`} color="border-yellow-500" />
                      <StatCard title="Active Users" value={allUsers.length.toString()} color="border-purple-500" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="bg-white p-6 rounded-2xl shadow-lg">
                        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center"><Factory className="mr-2 text-green-600" /> Environmental Impact Report</h3>
                        <div className="space-y-6">
                          <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                            <p className="text-sm text-green-700 font-bold mb-2">Materials Recovered</p>
                            <div className="grid grid-cols-3 gap-4 text-center">
                              <div>
                                <p className="text-xs text-green-600">Copper</p>
                                <p className="font-bold text-green-800">{analytics.materialsRecovered.copper.toFixed(2)} kg</p>
                              </div>
                              <div>
                                <p className="text-xs text-green-600">Plastic</p>
                                <p className="font-bold text-green-800">{analytics.materialsRecovered.plastic.toFixed(2)} kg</p>
                              </div>
                              <div>
                                <p className="text-xs text-green-600">Glass</p>
                                <p className="font-bold text-green-800">{analytics.materialsRecovered.glass.toFixed(2)} kg</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-sm text-blue-700 font-bold mb-1">Carbon Footprint Reduction</p>
                            <p className="text-2xl font-bold text-blue-800">{analytics.co2Saved.toFixed(1)} kg CO2 Offset</p>
                            <p className="text-xs text-blue-500 mt-1">Equivalent to planting {Math.round(analytics.co2Saved / 20)} trees</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl shadow-lg">
                        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center"><MapIcon className="mr-2 text-orange-600" /> High E-Waste Areas</h3>
                        <div className="space-y-4">
                          {analytics.highWasteAreas.map((area, i) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-orange-50 rounded-lg border border-orange-100">
                              <div className="flex items-center">
                                <MapPin className="w-4 h-4 text-orange-600 mr-2" />
                                <span className="text-sm font-mono text-orange-800">{area.coord}</span>
                              </div>
                              <span className="font-bold text-orange-900">{area.qty.toFixed(1)} kg</span>
                            </div>
                          ))}
                          {analytics.highWasteAreas.length === 0 && <p className="text-center text-gray-400 py-8">No location data available yet.</p>}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-lg">
                      <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center"><List className="mr-2 text-red-600" /> Complaints Management</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-gray-400 text-sm border-b">
                              <th className="pb-3 font-medium">User</th>
                              <th className="pb-3 font-medium">Subject</th>
                              <th className="pb-3 font-medium">Status</th>
                              <th className="pb-3 font-medium">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {complaints.map(c => (
                              <tr key={c.id} className="text-sm">
                                <td className="py-4 font-bold">{c.userId} <span className="text-[10px] text-gray-400 uppercase">({c.role})</span></td>
                                <td className="py-4">{c.subject}</td>
                                <td className="py-4">
                                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${c.status === 'Open' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{c.status}</span>
                                </td>
                                <td className="py-4">
                                  <div className="flex space-x-2">
                                    <button onClick={() => setModalContent(
                                      <div>
                                        <h2 className="text-xl font-bold mb-4">Complaint Details</h2>
                                        <p className="text-sm text-gray-500 mb-2">From: {c.userId} ({c.role})</p>
                                        <p className="font-bold mb-1">{c.subject}</p>
                                        <p className="bg-gray-50 p-4 rounded-lg text-gray-700 mb-4">{c.message}</p>
                                        {c.status === 'Open' && (
                                          <button onClick={() => { resolveComplaint(c.id); setModalContent(null); }} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold">Mark as Resolved</button>
                                        )}
                                      </div>
                                    )} className="text-blue-600 hover:underline">View</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {complaints.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-gray-400">No complaints found.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-lg">
                      <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center"><PlusCircle className="mr-2 text-blue-600" /> Public Awareness Notification</h3>
                      <form onSubmit={postNotification} className="space-y-4">
                        <input name="title" placeholder="Notification Title" required className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                        <textarea name="message" placeholder="Message content..." required className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 h-24"></textarea>
                        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition">Post Notification</button>
                      </form>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-lg">
                      <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center"><PlusCircle className="mr-2 text-purple-600" /> Import Dataset</h3>
                      <div className="p-8 border-2 border-dashed border-purple-200 rounded-2xl text-center">
                        <input type="file" accept=".json,.csv,.JSON,.CSV" onChange={handleImport} className="hidden" id="dataset-import" />
                        <label htmlFor="dataset-import" className="cursor-pointer flex flex-col items-center">
                          <PlusCircle className="w-12 h-12 text-purple-400 mb-4" />
                          <p className="text-purple-600 font-bold">Click to upload JSON or CSV dataset</p>
                          <p className="text-xs text-gray-400 mt-2">Upload historical requests or user data to sync with dashboard</p>
                        </label>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-lg">
                      <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center"><List className="mr-2 text-green-600" /> Manage Requests</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-gray-400 text-sm border-b">
                              <th className="pb-3 font-medium">ID</th>
                              <th className="pb-3 font-medium">User</th>
                              <th className="pb-3 font-medium">Waste</th>
                              <th className="pb-3 font-medium">Status</th>
                              <th className="pb-3 font-medium">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {requests.map(r => (
                              <tr key={r.id} className="text-sm">
                                <td className="py-4 font-mono">{r.id}</td>
                                <td className="py-4">{r.userId}</td>
                                <td className="py-4 capitalize">{r.type} ({r.quantity}kg)</td>
                                <td className="py-4">
                                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                                </td>
                                <td className="py-4">
                                  <div className="flex space-x-2">
                                    <button onClick={() => openDetails(r)} className="text-blue-600 hover:underline">View</button>
                                    {r.status === 'Sent to Authority' && (
                                      <button onClick={() => updateStatus(r.id, 'Sent to Recycler')} className="text-green-600 hover:underline">Forward</button>
                                    )}
                                    {r.collectorId && (
                                      <button onClick={() => openTracking(r.collectorId!)} className="text-purple-600 hover:underline">Track</button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-lg">
                      <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center"><UsersIcon className="mr-2 text-green-600" /> User Management</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-gray-400 text-sm border-b">
                              <th className="pb-3 font-medium">ID</th>
                              <th className="pb-3 font-medium">Name</th>
                              <th className="pb-3 font-medium">Role</th>
                              <th className="pb-3 font-medium">Status</th>
                              <th className="pb-3 font-medium">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {allUsers.map(u => (
                              <tr key={u.id} className="text-sm">
                                <td className="py-4 font-mono">{u.id}</td>
                                <td className="py-4">{u.name}</td>
                                <td className="py-4 capitalize">{u.role}</td>
                                <td className="py-4">
                                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.status}</span>
                                </td>
                                <td className="py-4">
                                  <div className="flex space-x-2">
                                    <button onClick={() => manageUser(u.id, u.status === 'active' ? 'block' : 'unblock')} className="text-orange-600 hover:underline">{u.status === 'active' ? 'Block' : 'Unblock'}</button>
                                    <button onClick={() => manageUser(u.id, 'delete')} className="text-red-600 hover:underline">Delete</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-lg">
                      <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center"><Factory className="mr-2 text-green-600" /> Disposal Monitoring</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="bg-gray-50 p-4 rounded-xl">
                          <h4 className="text-sm font-bold text-gray-400 uppercase mb-4">Disposal Methods Distribution (kg)</h4>
                          <div className="space-y-3">
                            {Object.entries(analytics.disposalStats).map(([method, qty]) => (
                              <div key={method} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">{method}</span>
                                  <span className="font-bold">{(qty as number).toFixed(1)} kg</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full ${method === 'Pending' ? 'bg-yellow-400' : 'bg-green-500'}`} 
                                    style={{ width: `${((qty as number) / analytics.totalWaste * 100) || 0}%` }}
                                  ></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl">
                          <h4 className="text-sm font-bold text-gray-400 uppercase mb-4">Recent Disposal Activities</h4>
                          <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2">
                            {requests.filter(r => r.disposalMethod).sort((a, b) => new Date(b.disposalDate!).getTime() - new Date(a.disposalDate!).getTime()).slice(0, 5).map(r => (
                              <div key={r.id} className="text-sm border-l-2 border-green-500 pl-3 py-1">
                                <p className="font-bold text-gray-800">{r.disposalMethod}</p>
                                <p className="text-gray-500 text-xs">{r.type} - {r.quantity}kg</p>
                                <p className="text-gray-400 text-[10px]">{new Date(r.disposalDate!).toLocaleString()}</p>
                              </div>
                            ))}
                            {requests.filter(r => r.disposalMethod).length === 0 && (
                              <p className="text-center text-gray-400 text-sm py-8">No disposal activities recorded yet.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-lg">
                      <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center"><Search className="mr-2 text-blue-600" /> AI Facility Finder (Google Maps)</h3>
                      <div className="flex space-x-2 mb-6">
                        <input 
                          type="text" 
                          value={aiSearchQuery}
                          onChange={(e) => setAiSearchQuery(e.target.value)}
                          placeholder="e.g., Find e-waste recycling centers in Bangalore" 
                          className="flex-grow px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                        />
                        <button onClick={handleAiSearch} disabled={aiSearching} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50">
                          {aiSearching ? 'Searching...' : 'Search'}
                        </button>
                      </div>
                      {aiSearchResults && (
                        <div className="bg-gray-50 rounded-xl p-6">
                          <div className="prose prose-sm max-w-none mb-4 whitespace-pre-wrap">{aiSearchResults.text}</div>
                          {aiSearchResults.sources.length > 0 && (
                            <div className="mt-4 border-t pt-4">
                              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Sources from Google Maps:</p>
                              <div className="space-y-2">
                                {aiSearchResults.sources.map((s, i) => (
                                  <a key={i} href={s.uri} target="_blank" rel="noreferrer" className="block p-2 bg-blue-50 hover:bg-blue-100 rounded text-blue-700 text-xs flex items-center justify-between">
                                    <span>{s.title}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {user.role === 'recycler' && (
                  <div className="bg-white p-6 rounded-2xl shadow-lg">
                    <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center"><Factory className="mr-2 text-green-600" /> Incoming Waste</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {requests.filter(r => r.status === 'Sent to Recycler').map(r => (
                        <div key={r.id} className="border rounded-xl p-4 space-y-4">
                          <h4 className="font-bold text-gray-800 capitalize">{r.type} - {r.quantity}kg</h4>
                          {r.image && <img src={r.image} className="w-full h-32 object-cover rounded-lg" />}
                          <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-400 uppercase">Disposal Method</label>
                            <select id={`method-${r.id}`} className="w-full px-3 py-2 border rounded-lg text-sm">
                              <option value="">Select Method</option>
                              <option value="Material Recovery">Material Recovery</option>
                              <option value="Energy Recovery">Energy Recovery</option>
                              <option value="Safe Disposal">Safe Disposal</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-400 uppercase">Set Evaluation Price (₹)</label>
                            <input id={`price-${r.id}`} type="number" placeholder="Enter total price" className="w-full px-3 py-2 border rounded-lg text-sm" />
                          </div>
                          <button onClick={() => evaluateRequest(r.id, (document.getElementById(`price-${r.id}`) as HTMLInputElement).value, (document.getElementById(`method-${r.id}`) as HTMLSelectElement).value)} className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-bold">Complete Evaluation</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Modal */}
      <AnimatePresence>
        {modalContent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 relative"
            >
              <button onClick={() => setModalContent(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-50">
                <X className="w-6 h-6" />
              </button>
              {modalContent}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="bg-white border-t py-4 text-center text-gray-500 text-sm">
        &copy; 2026 Smart E-Waste Collection System.
      </footer>
    </div>
  );
}

// --- Sub-components ---

function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div className={`bg-white p-6 rounded-2xl shadow-lg border-b-4 ${color}`}>
      <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">{title}</p>
      <h2 className="text-3xl font-bold text-gray-800 mt-1">{value}</h2>
    </div>
  );
}

function CollectorLocationUpdater({ collectorId }: { collectorId: string }) {
  const [coords, setCoords] = useState({ lat: 12.9716, lng: 77.5946 });

  useEffect(() => {
    const interval = setInterval(async () => {
      const newCoords = {
        lat: coords.lat + (Math.random() - 0.5) * 0.001,
        lng: coords.lng + (Math.random() - 0.5) * 0.001,
      };
      setCoords(newCoords);
      await fetch('/api/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectorId, ...newCoords })
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [coords, collectorId]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg">
      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center"><Navigation className="mr-2 text-green-600" /> Live Location Simulation</h3>
      <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm text-green-700">
        Lat: {coords.lat.toFixed(6)}, Lng: {coords.lng.toFixed(6)}
      </div>
    </div>
  );
}

function TrackingMap({ collectorId }: { collectorId: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const marker = useRef<any>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const fetchLocation = async () => {
      const res = await fetch(`/api/location/${collectorId}`);
      const data = await res.json();
      setCoords(data);

      if (mapRef.current && !leafletMap.current) {
        const streetLayer = (window as any).L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        });

        const satelliteLayer = (window as any).L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
        });

        const baseMaps = {
          "Street": streetLayer,
          "Satellite": satelliteLayer
        };

        leafletMap.current = (window as any).L.map(mapRef.current, {
          center: [data.lat, data.lng],
          zoom: 15,
          layers: [streetLayer]
        });

        (window as any).L.control.layers(baseMaps).addTo(leafletMap.current);

        marker.current = (window as any).L.marker([data.lat, data.lng]).addTo(leafletMap.current)
          .bindPopup(`<b>Collector: ${collectorId}</b>`)
          .openPopup();
      } else if (leafletMap.current && marker.current) {
        const newLatLng = new (window as any).L.LatLng(data.lat, data.lng);
        marker.current.setLatLng(newLatLng);
        leafletMap.current.panTo(newLatLng);
      }
    };

    fetchLocation();
    const interval = setInterval(fetchLocation, 5000);
    return () => {
      clearInterval(interval);
      if (leafletMap.current) leafletMap.current.remove();
    };
  }, [collectorId]);

  return (
    <div className="h-full">
      <h2 className="text-2xl font-bold mb-4">Live Tracking</h2>
      <div ref={mapRef} className="h-96 rounded-xl shadow-inner border border-gray-200 z-10"></div>
      <div className="mt-4 flex justify-between items-center">
        {coords ? (
          <div className="flex space-x-4">
            <span className="text-xs font-mono bg-green-50 text-green-700 px-2 py-1 rounded">Lat: {coords.lat.toFixed(6)}</span>
            <span className="text-xs font-mono bg-green-50 text-green-700 px-2 py-1 rounded">Lng: {coords.lng.toFixed(6)}</span>
          </div>
        ) : <p className="text-sm text-gray-500">Fetching live coordinates...</p>}
        <p className="text-xs text-gray-400">Last updated: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  );
}
