import React, { useState } from 'react';

interface NotesPanelProps {
  taskId: string;
  existingNotes: string[];
  onAddNote: (note: string) => void;
}

const NotesPanel: React.FC<NotesPanelProps> = ({ taskId, existingNotes, onAddNote }) => {
  const [note, setNote] = useState('');

  const handleAddNote = () => {
    if (note.trim()) {
      onAddNote(note);
      setNote('');
    }
  };

  return (
    <div>
      <h3>Notes for Task {taskId}</h3>
      <div>
        {existingNotes.map((existingNote, index) => (
          <div key={index}>{existingNote}</div>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note..."
      />
      <button onClick={handleAddNote}>Add Note</button>
    </div>
  );
};

export default NotesPanel;