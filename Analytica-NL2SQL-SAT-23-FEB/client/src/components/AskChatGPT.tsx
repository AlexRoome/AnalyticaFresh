import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BsFillArrowUpCircleFill } from "react-icons/bs";
import { FaCircleNotch } from "react-icons/fa";
import { IoRefreshCircle } from "react-icons/io5";
import "./AskChatGPT.css";
import { getCombinedTableData } from "../pages/Dashboard";

interface Message {
  role: "assistant" | "user";
  content: string;
}

interface AskAssistantResponse {
  status: "success" | "error";
  assistant_reply?: string;
  thread_id?: string;
  messages?: Message[];
  message?: string; // for error messages
}

// Helper to remove bracketed text: 【...】
function removeWeirdBrackets(str: string): string {
  return str.replace(/【[^】]*】/g, "");
}

export default function AskChatGPT() {
  const [statusMessage, setStatusMessage] = useState("");
  const [assistantId, setAssistantId] = useState("");
  const [threadId, setThreadId] = useState("");
  const [userQuestion, setUserQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAsking, setIsAsking] = useState(false);

  // Scroll container for conversation
  const conversationRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [messages]);

  const FLASK_REPL_URL =
    "https://dbc54b8b-f19d-47d3-88cf-d09a09a19df4-00-15dzxifnpw5hv.kirk.replit.dev";

  const handleUpdateVectorStore = async () => {
    try {
      setStatusMessage("Updating vector store...");
      const combinedData = getCombinedTableData();
      const res = await fetch(`${FLASK_REPL_URL}/update_vector_store`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(combinedData),
      });
      const data = await res.json();
      if (data.status === "success") {
        setStatusMessage(`Vector store updated! ID: ${data.vector_store_id}`);
        await createAssistant(data.vector_store_id);
      } else {
        setStatusMessage(`Error: ${data.message}`);
      }
    } catch (error) {
      console.error(error);
      setStatusMessage("Error updating vector store");
    }
  };

  const createAssistant = async (vectorStoreId: string) => {
    try {
      setStatusMessage("Creating assistant...");
      const res = await fetch(`${FLASK_REPL_URL}/create_assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructions:
            "You have data about apartments and finance. Use it to answer user questions or forecasting queries.",
          model: "gpt-4o",
          temperature: 0.1,
          vector_store_id: vectorStoreId,
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setAssistantId(data.assistant_id);
        setThreadId("");
        setMessages([]);
        setStatusMessage(`Assistant created! ID: ${data.assistant_id}`);
      } else {
        setStatusMessage(`Error creating assistant: ${data.message}`);
      }
    } catch (error) {
      console.error(error);
      setStatusMessage("Error creating assistant");
    }
  };

  const askAssistant = async () => {
    try {
      if (!assistantId) {
        setStatusMessage("No assistant ID. Please refresh the vector store first!");
        return;
      }
      if (!userQuestion.trim()) {
        setStatusMessage("Please enter a question before sending.");
        return;
      }
      // Immediately display user's question
      setMessages((prev) => [...prev, { role: "user", content: userQuestion }]);
      setUserQuestion("");

      // Show spinner
      setIsAsking(true);
      setStatusMessage("Asking assistant...");

      const res = await fetch(`${FLASK_REPL_URL}/ask_assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistant_id: assistantId,
          thread_id: threadId,
          user_message: userQuestion,
        }),
      });
      const data: AskAssistantResponse = await res.json();

      setIsAsking(false);

      if (data.status === "success") {
        setStatusMessage(`Assistant reply: ${data.assistant_reply}`);
        if (data.thread_id) {
          setThreadId(data.thread_id);
        }
        if (data.messages) {
          setMessages(data.messages);
        }
      } else {
        setStatusMessage(`Error asking assistant: ${data.message}`);
      }
    } catch (error) {
      console.error(error);
      setStatusMessage("Error asking assistant");
      setIsAsking(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    // auto-size the textarea
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
    setUserQuestion(e.target.value);
  };

  return (
    <div className="askChatGPTContainer">
      <h1>Instant insight into your data</h1>
      <p className="subheading">Converse with Analytica</p>

      <div ref={conversationRef} className="conversationContainer">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            {msg.role === "assistant" ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {removeWeirdBrackets(msg.content)}
              </ReactMarkdown>
            ) : (
              msg.content
            )}
          </div>
        ))}
      </div>

      <div className="searchBar">
        {/* Textarea on the left */}
        <textarea
          placeholder="Message Analytica.."
          value={userQuestion}
          onChange={handleChange}
        />

        {/* Refresh icon: 1rem left of the arrow */}
        <button
          onClick={handleUpdateVectorStore}
          style={{ marginRight: "1rem" }}
        >
          <IoRefreshCircle size={30} />
        </button>

        {/* Up arrow or spinner on the right */}
        <button onClick={askAssistant}>
          {isAsking ? (
            <FaCircleNotch size={30} className="spin" />
          ) : (
            <BsFillArrowUpCircleFill size={30} />
          )}
        </button>
      </div>

      {/* Hidden text for statuses/IDs */}
      <p className="hiddenText">{statusMessage}</p>
      <p className="hiddenText">Assistant ID: {assistantId}</p>
      <p className="hiddenText">Thread ID: {threadId}</p>
    </div>
  );
}
