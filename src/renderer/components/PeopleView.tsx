import React, { useEffect, useState, useCallback } from 'react';
import { Search, Mail, Building2, Calendar, Clock, FileText, Edit2, X, Check } from 'lucide-react';
import type { Person } from '@shared/types';
import { formatDuration } from '../lib/formatters';

export default function PeopleView() {
  const [people, setPeople] = useState<Person[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingField, setEditingField] = useState<'name' | 'organization' | 'notes' | null>(null);
  const [editValue, setEditValue] = useState('');

  const loadPeople = useCallback(async () => {
    setIsLoading(true);
    try {
      const peopleList = await window.kakarot.people.list();
      setPeople(peopleList);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      const results = await window.kakarot.people.search(searchQuery);
      setPeople(results);
    } else {
      loadPeople();
    }
  };

  const handleSelectPerson = (person: Person) => {
    setSelectedPerson(person);
    setEditingField(null);
  };

  const startEditing = (field: 'name' | 'organization' | 'notes', currentValue: string | undefined) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  };

  const saveEdit = async () => {
    if (!selectedPerson || !editingField) return;

    try {
      let updatedPerson: Person | null = null;
      
      switch (editingField) {
        case 'name':
          updatedPerson = await window.kakarot.people.updateName(selectedPerson.email, editValue);
          break;
        case 'organization':
          updatedPerson = await window.kakarot.people.updateOrganization(selectedPerson.email, editValue);
          break;
        case 'notes':
          updatedPerson = await window.kakarot.people.updateNotes(selectedPerson.email, editValue);
          break;
      }

      if (updatedPerson) {
        setSelectedPerson(updatedPerson);
        setPeople(people.map(p => p.email === updatedPerson!.email ? updatedPerson! : p));
      }
      
      setEditingField(null);
      setEditValue('');
    } catch (error) {
      console.error('Failed to update person:', error);
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const getInitials = (person: Person) => {
    if (person.name) {
      return person.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return person.email[0].toUpperCase();
  };

  const getAvatarColor = (email: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-teal-500',
    ];
    const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const formatLastMeeting = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  return (
    <div className="h-full flex bg-white">
      {/* People list sidebar */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50">
        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Contacts</h2>
            <p className="text-xs text-gray-500 mt-1">
              {people.length} {people.length === 1 ? 'contact' : 'contacts'}
            </p>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* People list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : people.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-gray-400 mb-2">
                <Mail className="w-12 h-12 mx-auto mb-3" />
              </div>
              <p className="text-gray-600 font-medium">No contacts yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Contacts are automatically created from meeting attendees
              </p>
            </div>
          ) : (
            people.map((person) => (
              <div
                key={person.email}
                onClick={() => handleSelectPerson(person)}
                className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors ${
                  selectedPerson?.email === person.email ? 'bg-gray-100' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${getAvatarColor(person.email)} flex items-center justify-center text-white font-medium text-sm flex-shrink-0`}>
                    {getInitials(person)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {person.name || person.email}
                    </h3>
                    {person.name && (
                      <p className="text-xs text-gray-500 truncate">{person.email}</p>
                    )}
                    {person.organization && (
                      <p className="text-xs text-gray-600 truncate mt-0.5">{person.organization}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {person.meetingCount} {person.meetingCount === 1 ? 'meeting' : 'meetings'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(person.totalDuration)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Contact detail panel */}
      <div className="flex-1 flex flex-col">
        {selectedPerson ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-br from-gray-50 to-white">
              <div className="flex items-start gap-4">
                <div className={`w-16 h-16 rounded-full ${getAvatarColor(selectedPerson.email)} flex items-center justify-center text-white font-medium text-xl flex-shrink-0`}>
                  {getInitials(selectedPerson)}
                </div>
                <div className="flex-1 min-w-0">
                  {editingField === 'name' ? (
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        className="flex-1 px-3 py-1.5 text-xl font-semibold text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        placeholder="Enter name"
                      />
                      <button
                        onClick={saveEdit}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-2">
                      <h1 className="text-2xl font-semibold text-gray-900">
                        {selectedPerson.name || 'Unnamed Contact'}
                      </h1>
                      <button
                        onClick={() => startEditing('name', selectedPerson.name)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Mail className="w-4 h-4" />
                    <span className="text-sm">{selectedPerson.email}</span>
                  </div>
                  
                  {editingField === 'organization' ? (
                    <div className="flex items-center gap-2 mt-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        className="flex-1 px-3 py-1 text-sm text-gray-700 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        placeholder="Enter organization"
                      />
                      <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={cancelEdit} className="p-1 text-gray-600 hover:bg-gray-100 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {selectedPerson.organization || 'No organization'}
                      </span>
                      <button
                        onClick={() => startEditing('organization', selectedPerson.organization)}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-medium">Meetings</span>
                  </div>
                  <div className="text-2xl font-semibold text-gray-900">{selectedPerson.meetingCount}</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-medium">Total Time</span>
                  </div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {formatDuration(selectedPerson.totalDuration)}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-medium">Last Met</span>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {formatLastMeeting(selectedPerson.lastMeetingAt)}
                  </div>
                </div>
              </div>
            </div>

            {/* Notes section */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
                  </div>
                  {editingField !== 'notes' && (
                    <button
                      onClick={() => startEditing('notes', selectedPerson.notes)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  )}
                </div>

                {editingField === 'notes' ? (
                  <div className="space-y-3">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full h-64 px-4 py-3 text-sm text-gray-700 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
                      placeholder="Add notes about this contact..."
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveEdit}
                        className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        Save Notes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    {selectedPerson.notes ? (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedPerson.notes}</p>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No notes yet. Click Edit to add notes about this contact.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Mail className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-400">Select a contact</p>
              <p className="text-sm text-gray-400 mt-1">Choose a contact to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
