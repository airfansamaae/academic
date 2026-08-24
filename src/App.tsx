/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Task,
  Announcement,
  Submission,
  DocumentItem,
  SystemSettings,
  NavigationTab,
} from './types';
import { StorageService } from './services/storage';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { TaskAssignment } from './components/TaskAssignment';
import { TrackingAndGrading } from './components/TrackingAndGrading';
import { DocumentCenter } from './components/DocumentCenter';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { Footer } from './components/Footer';
import { notifySuccess, notifyInfo } from './services/notifications';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => StorageService.getCurrentUser());
  const [users, setUsers] = useState<User[]>(() => StorageService.getUsers());
  const [tasks, setTasks] = useState<Task[]>(() => StorageService.getTasks());
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => StorageService.getAnnouncements());
  const [submissions, setSubmissions] = useState<Submission[]>(() => StorageService.getSubmissions());
  const [documents, setDocuments] = useState<DocumentItem[]>(() => StorageService.getDocuments());
  const [settings, setSettings] = useState<SystemSettings>(() => StorageService.getSettings());

  const [activeTab, setActiveTab] = useState<NavigationTab>('DASHBOARD');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(!currentUser);
  const [preSelectedTask, setPreSelectedTask] = useState<Task | null>(null);

  // Sync data refresh callback
  const refreshData = useCallback(() => {
    setCurrentUser(StorageService.getCurrentUser());
    setUsers(StorageService.getUsers());
    setTasks(StorageService.getTasks());
    setAnnouncements(StorageService.getAnnouncements());
    setSubmissions(StorageService.getSubmissions());
    setDocuments(StorageService.getDocuments());
    setSettings(StorageService.getSettings());
  }, []);

  useEffect(() => {
    refreshData();

    // Background sync with Cloudflare Worker D1
    StorageService.syncWithCloudflare().then(() => {
      refreshData();
    });

    const handleAuthChange = (e: any) => {
      const user = e.detail !== undefined ? e.detail : StorageService.getCurrentUser();
      setCurrentUser(user);
      refreshData();
    };

    window.addEventListener('academic-auth-change', handleAuthChange);
    return () => window.removeEventListener('academic-auth-change', handleAuthChange);
  }, [refreshData]);

  // Handle Logout
  const handleLogout = () => {
    StorageService.setCurrentUser(null);
    setCurrentUser(null);
    setIsAuthOpen(true);
    notifyInfo('ออกจากระบบเรียบร้อยแล้ว');
  };

  // Handle Login success
  const handleLoginSuccess = (user?: User) => {
    const activeUser = user || StorageService.getCurrentUser();
    setCurrentUser(activeUser);
    refreshData();
    setIsAuthOpen(false);
  };

  // Helper count badges
  const pendingReviewsCount = submissions.filter((s) => s.status === 'SUBMITTED').length;
  const pendingTasksCount = currentUser && currentUser.role === 'MEMBER'
    ? tasks.filter((t) => !submissions.some((s) => s.taskId === t.id && s.memberId === currentUser.id)).length
    : 0;
  const pendingUsersCount = users.filter((u) => u.status === 'PENDING').length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        settings={settings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Sidebar Navigation */}
          <Sidebar
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            userRole={currentUser?.role}
            pendingReviewsCount={pendingReviewsCount}
            pendingTasksCount={pendingTasksCount}
            pendingUsersCount={pendingUsersCount}
          />

          {/* Right Main Content Area */}
          <section className="flex-1 min-w-0">
            {activeTab === 'DASHBOARD' && (
              <Dashboard
                currentUser={currentUser}
                tasks={tasks}
                announcements={announcements}
                submissions={submissions}
                users={users}
                onNavigateTab={(tab) => {
                  setActiveTab(tab);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onSelectTaskToSubmit={(task) => {
                  setPreSelectedTask(task);
                  setActiveTab('ASSIGN_SUBMIT');
                }}
              />
            )}

            {activeTab === 'ASSIGN_SUBMIT' && (
              <TaskAssignment
                currentUser={currentUser}
                tasks={tasks}
                announcements={announcements}
                submissions={submissions}
                onRefreshData={refreshData}
                preSelectedTask={preSelectedTask}
              />
            )}

            {activeTab === 'TRACKING_REVIEW' && (
              <TrackingAndGrading
                currentUser={currentUser}
                tasks={tasks}
                submissions={submissions}
                users={users}
                onRefreshData={refreshData}
              />
            )}

            {activeTab === 'DOCUMENT_CENTER' && (
              <DocumentCenter
                currentUser={currentUser}
                documents={documents}
                onRefreshData={refreshData}
              />
            )}
          </section>
        </div>
      </main>

      {/* Footer */}
      <Footer settings={settings} />

      {/* Settings Modal (Top Right button) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={currentUser}
        settings={settings}
        users={users}
        onRefreshData={refreshData}
      />

      {/* Authentication Modal (Login / Register / Master Admin Bypass) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={currentUser ? () => setIsAuthOpen(false) : undefined}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
