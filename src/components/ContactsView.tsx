// src/components/ContactsView.tsx
// Address book & contacts management with instant 1-click compose trigger

import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Mail,
  Building,
  Phone,
  Trash2,
  Send,
  Edit2
} from 'lucide-react';
import { Contact } from '../types';
import { api } from '../api/client';

interface ContactsViewProps {
  contacts: Contact[];
  onRefreshData: () => void;
  onComposeTo: (email: string) => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  onRefreshData,
  onComposeTo,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredContacts = contacts.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q))
    );
  });

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setIsSubmitting(true);
    try {
      await api.createContact({ name, email, company, notes });
      setShowAddModal(false);
      setName('');
      setEmail('');
      setCompany('');
      setNotes('');
      onRefreshData();
    } catch (err: any) {
      alert(`Failed to save contact: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContact = async (id: string, contactName: string) => {
    if (!confirm(`Delete contact "${contactName}"?`)) return;
    try {
      await api.deleteContact(id);
      onRefreshData();
    } catch (err: any) {
      alert(`Failed to delete contact: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Users className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Contacts & Address Book</h1>
          </div>
          <p className="text-xs text-gray-500">
            Manage your personal and enterprise contacts, autocomplete addresses when composing, and view history.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Contact</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search contacts by name, email or company..."
          className="w-full bg-white text-gray-800 placeholder-gray-400 pl-10 pr-4 py-2.5 rounded-xl text-xs outline-none border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs"
        />
      </div>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContacts.map((c) => (
          <div
            key={c.id}
            className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow group"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                      c.name
                    )}&background=2563eb&color=fff`}
                    alt="Avatar"
                    className="w-10 h-10 rounded-full object-cover border border-gray-200"
                  />
                  <div>
                    <h3 className="font-bold text-sm text-gray-900">{c.name}</h3>
                    <div className="text-xs text-gray-500 font-normal">{c.email}</div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteContact(c.id, c.name)}
                  className="p-1 text-gray-300 hover:text-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete Contact"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {c.company && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Building className="w-3.5 h-3.5 text-gray-400" />
                  <span>{c.company}</span>
                </div>
              )}

              {c.notes && (
                <div className="text-[11px] text-gray-400 italic line-clamp-2">{c.notes}</div>
              )}
            </div>

            <div className="pt-4 mt-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => onComposeTo(c.email)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg text-xs transition-colors"
              >
                <Send className="w-3 h-3" />
                <span>Send Email</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full p-6 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-gray-900">Add New Contact</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-gray-400 hover:text-gray-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sarah@clientcorp.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Company / Organization</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Client Ventures LLC"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Notes / Tags</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Key stakeholder for Q3 enterprise rollout..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs"
                >
                  {isSubmitting ? 'Saving...' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
