import React from "react";
import { Search, Download, Calendar, Clock, CheckCircle, Activity, Smile } from "lucide-react";
import { mockHistory } from "../lib/mockData";

export default function HistoryView() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8 h-full font-sans text-slate-800">
      <h1 className="text-2xl font-bold">Request History</h1>
      <p className="text-slate-500 text-sm mt-1 mb-6">Manage and monitor all platform support and system requests.</p>

      <div className="flex gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search requests..." className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg py-2 pl-9 pr-4 outline-none" />
        </div>
        <select className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-4 outline-none w-40"><option>Status: All</option></select>
        <select className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-4 outline-none w-40"><option>Priority: All</option></select>
        <button className="bg-blue-600 text-white flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"><Download className="w-4 h-4" /> Export CSV</button>
      </div>

      {/* Cards thống kê */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Clock className="w-5 h-5" /></div>
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">+12%</span>
          </div>
          <h2 className="text-3xl font-bold">24</h2>
          <p className="text-xs font-semibold text-slate-400 mt-1 uppercase">Pending Requests</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Activity className="w-5 h-5" /></div>
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">-4h</span>
          </div>
          <h2 className="text-3xl font-bold">1.2h</h2>
          <p className="text-xs font-semibold text-slate-400 mt-1 uppercase">Avg. Resolution Time</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Smile className="w-5 h-5" /></div>
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">98%</span>
          </div>
          <h2 className="text-3xl font-bold">4.8/5</h2>
          <p className="text-xs font-semibold text-slate-400 mt-1 uppercase">CSAT Score</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-100">
            <tr>
              <th className="px-6 py-4">Request ID</th><th className="px-6 py-4">Subject</th><th className="px-6 py-4">Category</th><th className="px-6 py-4">User</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Created</th><th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mockHistory.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-semibold text-blue-600">{row.id}</td>
                <td className="px-6 py-4"><div className="font-semibold">{row.subject}</div><div className="text-xs text-slate-500">{row.sub}</div></td>
                <td className="px-6 py-4 text-slate-600">{row.category}</td>
                <td className="px-6 py-4 flex items-center gap-3">
                  {row.img ? <img src={row.img} className="w-8 h-8 rounded-full" alt="user" /> : <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${row.color}`}>{row.initials}</div>}
                  <span className="text-slate-700">{row.user}</span>
                </td>
                <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${row.statusColor}`}>{row.status}</span></td>
                <td className="px-6 py-4 text-slate-500">{row.date}</td>
                <td className="px-6 py-4"><button className="text-blue-600 font-semibold">View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}