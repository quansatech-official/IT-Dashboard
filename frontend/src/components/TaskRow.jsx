export default function TaskRow({ task }) {
  return (
    <div>
      ⏱ {task.title} {task.billable ? "✔" : ""}
    </div>
  );
}
