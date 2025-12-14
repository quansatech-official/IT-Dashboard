import { useState } from "react";

export default function Pinboard() {
  const [text, setText] = useState("");
  return (
    <div style={{width:300, padding:10, borderLeft:"1px solid #ccc"}}>
      <h3>Pinwand</h3>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        style={{width:"100%", height:200}}
      />
    </div>
  );
}
