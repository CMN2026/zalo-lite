import React from "react";
import { Download, Calendar, Star } from "lucide-react";
import { mockStatsTickets } from "../lib/mockData";

export default function StatsView() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8 h-full font-sans text-slate-800">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Performance & Feedback</h1>
          <p className="text-slate-500 text-sm mt-1">Personal metrics and customer satisfaction insights</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"><Calendar className="w-4 h-4" /> Last 30 Days</button>
          <button className="bg-blue-600 text-white flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"><Download className="w-4 h-4" /> Export My Stats</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-6">
        {/* Mock Data Stats */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-2"><span className="text-xs font-bold text-slate-500 uppercase">My Resolution Rate</span></div>
          <h2 className="text-4xl font-bold mb-2">96.5%</h2>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4"><div className="bg-blue-600 h-1.5 rounded-full w-[96.5%]"></div></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-2"><span className="text-xs font-bold text-slate-500 uppercase">Avg. Handling Time</span></div>
          <h2 className="text-4xl font-bold mb-1">8m 12s</h2>
          <p className="text-xs text-slate-500">Target: &lt; 10m 00s</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-2"><span className="text-xs font-bold text-slate-500 uppercase">Personal CSAT Score</span></div>
          <h2 className="text-4xl font-bold mb-2">4.9/5.0</h2>
          <div className="flex text-yellow-400 gap-1"><Star className="w-4 h-4 fill-current"/><Star className="w-4 h-4 fill-current"/><Star className="w-4 h-4 fill-current"/><Star className="w-4 h-4 fill-current"/><Star className="w-4 h-4 fill-current"/></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-2"><span className="text-xs font-bold text-slate-500 uppercase">Tickets Resolved</span></div>
          <h2 className="text-4xl font-bold mt-1">42</h2>
          <p className="text-xs text-slate-500 mt-2">Top 5% of Team today</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-6">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold">Recent High-Priority Tickets I Handled</h3></div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-100">
            <tr><th className="px-6 py-4">Ticket ID</th><th className="px-6 py-4">Subject</th><th className="px-6 py-4">Category</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Rating</th><th className="px-6 py-4">Customer Comment</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mockStatsTickets.map((row, i) => (
              <tr key={i}>
                <td className="px-6 py-4 font-semibold text-blue-600">{row.id}</td>
                <td className="px-6 py-4"><div className="font-bold">{row.subject}</div><div className="text-xs text-slate-500">{row.sub}</div></td>
                <td className="px-6 py-4">{row.category}</td>
                <td className="px-6 py-4"><span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-sm uppercase">{row.status}</span></td>
                <td className="px-6 py-4">{row.rating === 0 ? <span className="text-slate-500">Pending</span> : <div className="flex text-yellow-400 gap-0.5">{[...Array(row.rating)].map((_, idx) => <Star key={idx} className="w-4 h-4 fill-current"/>)}</div>}</td>
                <td className="px-6 py-4 text-slate-500 truncate max-w-[250px]">{row.comment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}