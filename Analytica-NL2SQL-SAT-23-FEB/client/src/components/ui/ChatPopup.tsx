import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import ReactDOM from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { BsFillArrowUpCircleFill, BsXCircleFill } from "react-icons/bs";
import { FaCircleNotch } from "react-icons/fa";
import "./ChatPopup.css";
import { supabase } from "../../supabaseClient";

interface Message {
  role: "assistant" | "user";
  content: string;
}

interface ChatPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const TABLE_NAMES = [
  "documents",
  "feasibilities",
  "feasibility_line_items",
  "feasibility_participants",
  "gantt",
  "gantt_links",
  "invoices",
  "management_costs",
  "management_costs_view",
  "profiles",
  "tax_rates"
];

// Helper function to format numbers to 2 decimal places
const formatNumber = (num: number): string => {
  return Number(num).toFixed(2);
};

const useAllTablesData = () => {
  const [allTablesData, setAllTablesData] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const subscriptions: any[] = [];

    const fetchData = async (table: string) => {
      const { data, error } = await supabase.from(table).select("*");
      if (error) {
        alert(`Error fetching data for ${table}: ${error.message}`);
      } else if (data) {
        setAllTablesData(prev => ({ ...prev, [table]: data }));
      }
    };

    const subscribeTable = (table: string) => {
      fetchData(table);
      const channel = supabase.channel(`${table}-channel`, {
        config: { broadcast: { self: true } },
      })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => {
            fetchData(table);
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log(`Subscribed to realtime updates for ${table}`);
          } else if (status === "ERROR") {
            alert(`Subscription error for ${table}`);
          }
        });

      subscriptions.push(channel);
    };

    TABLE_NAMES.forEach(table => subscribeTable(table));

    return () => {
      subscriptions.forEach(subscription => {
        supabase.removeChannel(subscription);
      });
    };
  }, []);

  return allTablesData;
};

const getDirectQueryResult = (userMessage: string, allTablesData: Record<string, any[]>): string | null => {
  const msg = userMessage.toLowerCase();

  if (msg.includes("latest") && msg.includes("invoice") && msg.includes("abc supplies")) {
    const vendorName = "ABC Supplies";
    const invoices = allTablesData["invoices"] || [];
    const filtered = invoices.filter((row: any) =>
      row.supplier && row.supplier.toLowerCase() === vendorName.toLowerCase()
    );
    if (filtered.length > 0) {
      filtered.sort((a: any, b: any) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime());
      const column = msg.includes("excluding gst") ? "amount_excl_gst" : "amount_incl_gst";
      const latest = filtered[0];
      if (latest && latest[column] !== undefined) {
        return `The latest invoice for ${vendorName} has ${column === "amount_excl_gst" ? "an amount excluding GST" : "an amount including GST"} of ${formatNumber(latest[column])}.`;
      }
      return `No valid invoice data found for ${vendorName}.`;
    }
    return `No invoice found for ${vendorName}.`;
  }

  if (msg.includes("total amount") && msg.includes("invoices")) {
    const column = msg.includes("excluding gst") ? "amount_excl_gst" : "amount_incl_gst";
    const invoices = allTablesData["invoices"] || [];
    if (invoices.length > 0) {
      const total = invoices.reduce((sum: number, row: any) => sum + Number(row[column] || 0), 0);
      return `The total ${column === "amount_excl_gst" ? "amount excluding GST" : "amount including GST"} for invoices is ${formatNumber(total)}.`;
    }
    return "No invoices data available.";
  }

  return null;
};

const getAIResponse = async (
  userMessage: string,
  conversationHistory: Message[],
  allTablesData: Record<string, any[]>,
  schemaData: any
): Promise<string> => {
  const directResult = getDirectQueryResult(userMessage, allTablesData);
  if (directResult !== null) {
    return directResult;
  }

  const systemContent = `
You are an expert in property development data analysis.
You have access to the following database schema and row-level data.
Wherever possible, perform the calculation and return the calculated answer based on the provided data.

SCHEMA:
${schemaData ? JSON.stringify(schemaData, null, 2) : "(no schema loaded)"}

DATA:
${JSON.stringify(allTablesData, null, 2)}

Answer the user's question using the data. You may reference table/column names if needed.
Ensure that all numerical values are rounded to 2 decimal places.
`;

  const messagesForOpenAI = [
    { role: "system", content: systemContent },
    ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage }
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: messagesForOpenAI,
        temperature: 0.3,
        max_tokens: 500
      })
    });
    const json = await response.json();
    if (json && json.choices && json.choices[0].message) {
      return json.choices[0].message.content.trim();
    }
    return "No response from OpenAI.";
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    return "Error communicating with OpenAI.";
  }
};

const ChatPopup: React.FC<ChatPopupProps> = ({ isOpen, onClose }) => {
  const [userQuestion, setUserQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>(() => {
    const storedHistory = localStorage.getItem("chatPopupHistory");
    return storedHistory ? JSON.parse(storedHistory) : [];
  });
  const [isSending, setIsSending] = useState(false);
  const [schemaData, setSchemaData] = useState<any>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const allTablesData = useAllTablesData();

  useEffect(() => {
    localStorage.setItem("chatPopupHistory", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    async function fetchSchema() {
      try {
        const res = await fetch("/api/schema");
        if (!res.ok) throw new Error("Failed to fetch schema");
        const data = await res.json();
        setSchemaData(data);
      } catch (error) {
        console.error("Error fetching schema:", error);
      }
    }
    fetchSchema();
  }, []);

  // Streams the AI response progressively
  const streamAIResponse = async (userMessage: string, assistantMessageIndex: number) => {
    const systemContent = `
You are an expert in property development data analysis.
You have access to the following database schema and row-level data.
Wherever possible, perform the calculation and return the calculated answer based on the provided data.

SCHEMA:
${schemaData ? JSON.stringify(schemaData, null, 2) : "(no schema loaded)"}

DATA:
${JSON.stringify(allTablesData, null, 2)}

Answer the user's question using the data. You may reference table/column names if needed.
Ensure that all numerical values are rounded to 2 decimal places.
    `;

    const conversationHistory = [...messages, { role: "user", content: userMessage }];

    const directResult = getDirectQueryResult(userMessage, allTablesData);
    if (directResult !== null) {
      setMessages(prev => {
        const updated = [...prev];
        updated[assistantMessageIndex] = { role: "assistant", content: directResult };
        return updated;
      });
      return;
    }

    const requestPayload = {
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemContent },
        ...conversationHistory
      ],
      temperature: 0.3,
      stream: true,
      max_tokens: 500
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let done = false;
    let assistantContent = "";
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      const lines = chunkValue.split("\n").filter(line => line.trim() !== "");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.replace("data: ", "").trim();
          if (dataStr === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices[0].delta;
            if (delta && delta.content) {
              assistantContent += delta.content;
              setMessages(prev => {
                const updated = [...prev];
                updated[assistantMessageIndex] = { role: "assistant", content: assistantContent };
                return updated;
              });
            }
          } catch (err) {
            console.error("Error parsing stream chunk", err);
          }
        }
      }
    }
  };

  const sendMessage = async () => {
    if (!userQuestion.trim()) return;
    setIsSending(true);
    setMessages(prev => [...prev, { role: "user", content: userQuestion }]);
    const currentMessages = [...messages, { role: "user", content: userQuestion }];
    setUserQuestion("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
    }
    const assistantMessageIndex = currentMessages.length;
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);
    try {
      await streamAIResponse(userQuestion, assistantMessageIndex);
    } catch (error) {
      console.error("Error sending message:", error);
      alert("There was an error sending your message.");
    } finally {
      setIsSending(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    localStorage.removeItem("chatPopupHistory");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setUserQuestion(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="chat-popup-overlay" onClick={onClose}>
      <div className="chat-popup" onClick={e => e.stopPropagation()}>
        <div className="conversation" ref={conversationRef}>
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              {msg.role === "assistant" ? (
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <span>{msg.content}</span>
              )}
            </div>
          ))}
        </div>
        <div className="input-section">
          <div className="message-input">
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              placeholder="Message Analytica"
              value={userQuestion}
              onChange={handleChange}
              onKeyPress={handleKeyPress}
            />
            <div className="button-row">
              <button className="icon-button clear-button" onClick={handleClearHistory}>
                <BsXCircleFill size={20} />
              </button>
              <button className="icon-button send-button" onClick={sendMessage} disabled={isSending}>
                {isSending ? <FaCircleNotch size={30} className="spin" /> : <BsFillArrowUpCircleFill size={30} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ChatPopup;
