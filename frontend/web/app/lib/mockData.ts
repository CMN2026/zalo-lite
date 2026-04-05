export const mockConversations = [
  {
    id: 1,
    name: "Alex Sterling",
    avatar: "https://i.pravatar.cc/150?u=alex",
    time: "12:45 PM",
    preview: "I need help with my recent billing stateme...",
    online: true,
    email: "alex.sterling@example.com",
    phone: "+1 (555) 123-4567",
    subject: "API Token Revocation",
    category: "Technical",
    messages: [
      { id: 1, sender: "user", text: "Hi, I noticed an extra charge of $25 on my latest invoice. Can you help me understand what this is for?", time: "12:40 PM" },
      { id: 2, sender: "ai", text: 'Hello Alex! I\'m the OTT Care assistant. I see the charge you\'re referring to. It appears to be a "Priority Support" add-on that was activated on Oct 20th. Would you like me to detail the benefits or help you cancel it?', time: "12:41 PM" },
      { id: 3, sender: "agent", text: "I've also just joined the chat to monitor this. We can definitely process a refund if this was activated by mistake.", time: "12:44 PM" },
      { id: 4, sender: "user", text: "That would be great, thank you. I don't recall activating that.", time: "12:45 PM" },
    ],
  },
  {
    id: 2,
    name: "Marcus Chen",
    avatar: "https://i.pravatar.cc/150?u=marcus",
    time: "Yesterday",
    preview: "Thank you for the quick resolution!",
    online: false,
    email: "marcus.c@example.com",
    phone: "+1 (555) 987-6543",
    subject: "Login Issue",
    category: "Support",
    messages: [
      { id: 1, sender: "user", text: "I can't login to my account.", time: "10:00 AM" },
      { id: 2, sender: "agent", text: "I have reset your password. Please check your email.", time: "10:15 AM" },
      { id: 3, sender: "user", text: "Thank you for the quick resolution!", time: "10:20 AM" },
    ],
  },
];

export const mockHistory = [
  { id: "#REQ-8241", subject: "API Connection Timeout", sub: "Integration Module Failure", category: "Technical", user: "Alex Lohan", initials: "AL", color: "bg-blue-100 text-blue-600", status: "In Progress", statusColor: "bg-yellow-100 text-yellow-700", date: "Oct 24, 2023" },
  { id: "#REQ-8239", subject: "New Feature: Bulk Export", sub: "Analytics Dashboard", category: "Billing", user: "Sarah Chen", img: "https://i.pravatar.cc/150?u=sarah", status: "Resolved", statusColor: "bg-green-100 text-green-700", date: "Oct 23, 2023" },
  { id: "#REQ-8235", subject: "Password Reset Loop", sub: "Authentication Flow", category: "Account", user: "Marcus Wright", initials: "MW", color: "bg-indigo-100 text-indigo-600", status: "Open", statusColor: "bg-slate-100 text-slate-600", date: "Oct 22, 2023" },
  { id: "#REQ-8230", subject: "UI Glitch in Dark Mode", sub: "Frontend - Settings Page", category: "UI/UX", user: "Lena Russo", img: "https://i.pravatar.cc/150?u=lena", status: "Resolved", statusColor: "bg-green-100 text-green-700", date: "Oct 20, 2023" },
];

export const mockStatsTickets = [
  { id: "#OTT-4821", subject: "Account breach suspected - Emergency locked", sub: "Resolved 10m ago", category: "Security", status: "RESOLVED", rating: 0, comment: "No comment yet - awaiting survey response." },
  { id: "#OTT-4799", subject: "Double billing on annual subscription", sub: "Resolved 2h ago", category: "Billing", status: "RESOLVED", rating: 5, comment: "Very helpful and quick! Solved my billing is..." },
  { id: "#OTT-4752", subject: "Cannot access 4K content on mobile", sub: "Resolved 5h ago", category: "Technical", status: "RESOLVED", rating: 4, comment: "Friendly agent. Took a bit long to find the a..." },
];