import React from "react";

const INSTRUCTION_STEPS = [
  {
    title: "Reviewing Conversations",
    description: (
      <>
        Switch to the <strong>Support</strong> tab → select a conversation on the
        left panel.
      </>
    ),
  },
  {
    title: "Closing Conversations",
    description: (
      <>
        When the issue is resolved, tap <strong>Close Ticket</strong>{" "}
        to mark the conversation as "Resolved".
      </>
    ),
  },
  {
    title: "Human Escalation",
    description: "The chatbot will automatically escalate the conversation to a support agent when it detects a complex issue or manually requested.",
  },
];

/**
 * HistoryView — Support History Dashboard.
 * Displays instructions for users to review support chats.
 */
export default function HistoryView() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#fafbfc] px-10 py-12 h-full font-sans text-slate-800">
      <div className="max-w-2xl mx-auto pt-6 text-center">
        <h1 className="text-[28px] font-bold tracking-tight text-slate-900 mb-2.5">
          Support History
        </h1>
        <p className="text-slate-500 text-[15px] mb-10 leading-relaxed max-w-xl mx-auto">
          All conversations with the support chatbot are securely archived and can be
          reviewed from the <strong>Support</strong> tab. Choose a conversation
          from the left panel to review its contents.
        </p>

        <div className="grid grid-cols-1 gap-5 text-left">
          {INSTRUCTION_STEPS.map((step, index) => (
            <div key={index} className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6 hover:shadow-md transition-shadow">
              <h3 className="text-base font-bold text-slate-800 mb-1.5">{step.title}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}