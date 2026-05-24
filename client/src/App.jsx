import { useState } from 'react';

const API_URL =  'https://ai-gateway-production-4178.up.railway.app';
const API_KEY = 'testuser123'; // hardcoded for now

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

const sendMessage = async () => {
  if (!input.trim() || loading) return;

  const text = input.trim();
  const userMsg = { role: 'user', text };
  setMessages(prev => [...prev, userMsg]);
  setInput('');
  setLoading(true);
  setError(null);

  // Add an empty AI message — we'll fill it word by word
  setMessages(prev => [...prev, { role: 'ai', text: '' }]);

  try {
    const res = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        message: text,
        history: messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.text
        })),
      }),
    });

    // Read the SSE stream chunk by chunk
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line for next chunk

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const json = JSON.parse(line.slice(6));

        if (json.done) break;
        if (json.error) { setError(json.error); break; }

        if (json.word) {
          // Append word to the LAST message in the list
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: 'ai',
              text: updated[updated.length - 1].text + json.word
            };
            return updated;
          });
        }
      }
    }
  } catch (err) {
    setError('Could not reach the server');
  } finally {
    setLoading(false);
  }
};

return (
  <div style={styles.app}>
    <h1 style={styles.title}>AI Gateway Chat</h1>

    <div style={styles.messages}>
      {messages.map((m, i) => (
        <div key={i} style={m.role === 'user'
          ? styles.userMsg : styles.aiMsg}>
          {m.text}
        </div>
      ))}
      {error && <div style={styles.errorMsg}>{error}</div>}
    </div>

    <div style={styles.inputRow}>
      <input
        style={styles.input}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && sendMessage()}
        placeholder="Type a message..."
      />
      <button style={styles.btn} onClick={sendMessage}>
        Send
      </button>
    </div>
  </div>
);
}

const styles = {
  app: {
    maxWidth: '640px', margin: '40px auto',
    fontFamily: 'sans-serif', padding: '0 16px'
  },
  title: {
    fontSize: '20px', fontWeight: '500',
    marginBottom: '16px', color: '#111'
  },
  messages: {
    border: '1px solid #e5e5e5', borderRadius: '12px',
    padding: '16px', minHeight: '400px',
    marginBottom: '12px', display: 'flex',
    flexDirection: 'column', gap: '10px'
  },
  userMsg: {
    alignSelf: 'flex-end', background: '#E6F1FB',
    color: '#0C447C', padding: '9px 13px',
    borderRadius: '12px 12px 4px 12px', maxWidth: '75%'
  },
  aiMsg: {
    alignSelf: 'flex-start', background: '#f4f4f4',
    color: '#111', padding: '9px 13px',
    borderRadius: '12px 12px 12px 4px', maxWidth: '75%'
  },
  errorMsg: {
    alignSelf: 'flex-start', background: '#FCEBEB',
    color: '#791F1F', padding: '9px 13px',
    borderRadius: '12px', fontSize: '13px'
  },
  inputRow: {
    display: 'flex', gap: '8px'
  },
  input: {
    flex: '1', padding: '10px 14px', fontSize: '14px',
    border: '1px solid #e5e5e5', borderRadius: '8px',
    outline: 'none'
  },
  btn: {
    padding: '10px 20px', background: '#378ADD',
    color: '#fff', border: 'none',
    borderRadius: '8px', cursor: 'pointer',
    fontSize: '14px'
  }
};
