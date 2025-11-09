import React from 'react';

interface TaskItemProps {
    title: string;
    dueDate: string;
    assignedTo: string;
    estimatedTime: string;
    completed: boolean;
    notes: string[];
    timeSpent: string;
    onComplete: () => void;
    onAddNote: (note: string) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({
    title,
    dueDate,
    assignedTo,
    estimatedTime,
    completed,
    notes,
    timeSpent,
    onComplete,
    onAddNote,
}) => {
    const [noteInput, setNoteInput] = React.useState('');

    const handleAddNote = () => {
        if (noteInput.trim()) {
            onAddNote(noteInput);
            setNoteInput('');
        }
    };

    return (
        <div className="task-item">
            <h3>{title}</h3>
            <p>Due Date: {dueDate}</p>
            <p>Assigned To: {assignedTo}</p>
            <p>Estimated Time: {estimatedTime}</p>
            <p>Completed: {completed ? 'Yes' : 'No'}</p>
            <p>Time Spent: {timeSpent}</p>
            <div>
                <button onClick={onComplete}>Mark as Completed</button>
            </div>
            <div>
                <h4>Notes:</h4>
                <ul>
                    {notes.map((note, index) => (
                        <li key={index}>{note}</li>
                    ))}
                </ul>
                <input
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Add a note"
                />
                <button onClick={handleAddNote}>Add Note</button>
            </div>
        </div>
    );
};

export default TaskItem;