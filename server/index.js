
require('dotenv').config();

const express = require('express');
const app=express();
const redis=require('redis');
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const cors=require('cors');

app.use(cors({
  origin: ['http://localhost:5173',
  'https://ai-gateway-self-ten.vercel.app']
}));

app.use(express.json());


app.get('/',(req,res)=>{
res.json({message :'Gateway is alive!'})
});

const redisclient=redis.createClient({
   url: process.env.REDIS_URL
});
redisclient.connect();

redisclient.on('connect',()=>
{
console.log('redis is connected');
})

redisclient.on('error',(err)=>{
    console.log('error :',err);
})

const apikeymiddleware=(req,res,next)=>{
    const apikey=req.headers['x-api-key'];
    if(!apikey)
    {
        return res.status(401).json({
            error:'Api Missing key'
        });
    }
    console.log('Api key:',apikey);
    next();
}

const requestlimiter = async (req, res, next) => {

    const apiKey = req.headers['x-api-key'];

    const requests = parseInt(await redisclient.incr(apiKey));

   // await redisclient.del(apiKey);



    if(requests === 1) {

        await redisclient.expire(apiKey, 10);

        console.log('Timer Started For:', apiKey);

    }

   //console.log('Current Count:', requests);

    if(requests > 5) {

        return res.status(429).json({
            error: 'Too Many Requests'
        });
    }

    next();
};
app.post('/chat',apikeymiddleware,requestlimiter,async (req,res)=>{
 const { message, history = [] } = req.body;

if(!message)
{
    return res.status(400).json({error:'Message is required'})
}
console.log(message);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

try {
    // stream: true tells Groq to send words as they generate
    const stream = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 1024,
      stream: true, 
      messages: [
        ...history,
        { role: 'user', content: message }
      ]
    });

     for await (const chunk of stream) {
      const word = chunk.choices[0]?.delta?.content || '';
      if (word) {
        // Send each word to React immediately
        res.write(`data: ${JSON.stringify({ word })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

      } catch (err) {
    console.error('Groq error:', err.message);
    res.write(`data: ${JSON.stringify({ error: 'AI error' })}\n\n`);
    res.end();
  }


// const reply = response.choices[0].message.content;

//     res.json({
//       reply,
//       usage: response.usage  // input/output token counts
//     });
// }
});


app.use((req, res,) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(process.env.PORT, () => {
  console.log('Server running on port 3001');
});

