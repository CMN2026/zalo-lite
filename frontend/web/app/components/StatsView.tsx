import React from "react";

const STAT_ITEMS = [
  { label: "Total Conversations", value: "—", subtext: "Loading..." },
  { label: "Resolved", value: "—", subtext: "Loading..." },
  { label: "Requires Agent", value: "—", subtext: "Loading..." },
  { label: "Learned Patterns", value: "—", subtext: "Loading..." },
];

/**
 * StatsView — Chatbot Statistics.
 * Placeholder UI — real data will be fetched from /api/chatbot/stats.
 */
export default function StatsView() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#fafbfc] px-10 py-12 h-full font-sans text-slate-800">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">Chatbot Statistics</h1>
          <p className="text-slate-500 text-[15px] mt-1.5">
            Performance metrics and customer support quality indicators.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-8">
        {STAT_ITEMS.map((item, index) => (
          <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/60">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              {item.label}
            </p>
            <h2 className="text-4xl font-extrabold text-slate-800">{item.value}</h2>
            <p className="text-xs text-slate-400 mt-2 font-medium">{item.subtext}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 p-8 text-center mt-6">
        <h3 className="text-base font-bold text-slate-800 mb-2">
          Feature in development
        </h3>
        <p className="text-[14px] text-slate-500 max-w-md mx-auto leading-relaxed">
          Detailed metrics dashboard will be integrated with the endpoint{" "}
          <code className="bg-slate-100 px-1.5 py-0.5 rounded textxs font-mono text-slate-700">
            GET /api/chatbot/stats
          </code>{" "}
          in the upcoming release.
        </p>
      </div>
    </div>
  );
}