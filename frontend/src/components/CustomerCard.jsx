import TaskRow from "./TaskRow";

export default function CustomerCard({ customer }) {
  return (
    <div style={{border:"1px solid #ccc", padding:10, marginBottom:10}}>
      <h3>{customer.name}</h3>
      {customer.tasks.map(t => <TaskRow key={t.id} task={t} />)}
    </div>
  );
}
