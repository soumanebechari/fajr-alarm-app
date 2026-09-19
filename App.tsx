import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Bell,
  Smartphone,
  Sparkles,
  Info,
  Volume2,
  HelpCircle,
  Play
} from 'lucide-react';
import { Alarm, TabType } from './types';
import { startAlarmPlayback, stopAlarmPlayback, previewAlarmSound } from './utils/audio';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { AlarmCard } from './components/AlarmCard';
import { AlarmModal } from './components/AlarmModal';
import { RingingAlarmModal } from './components/RingingAlarmModal';
import { PWAInstallModal } from './components/PWAInstallModal';
import { ClockView } from './components/ClockView';
import { TimerView } from './components/TimerView';
import { StopwatchView } from './components/StopwatchView';
import { RelaxSoundsView } from './components/RelaxSoundsView';
import { OfflineIndicator } from './components/OfflineIndicator';

const DEFAULT_ALARMS: Alarm[] = [
  {
    id: 'fajr-1',
    time: '05:00',
    label: 'صلاة الفجر وقراءة الأذكار',
    enabled: true,
    days: [0, 1, 2, 3, 4, 5, 6], // Everyday
    sound: 'gentle',
    volume: 0.85,
    snoozeMinutes: 5,
    challenge: 'none',
    vibrate: true,
    createdAt: Date.now() - 100000,
  },
  {
    id: 'work-2',
    time: '07:00',
    label: 'الاستيقاظ للعمل والنشاط',
    enabled: true,
    days: [0, 1, 2, 3, 4], // Weekdays
    sound: 'energetic',
    volume: 0.9,
    snoozeMinutes: 5,
    challenge: 'math',
    vibrate: true,
    createdAt: Date.now() - 50000,
  },
];

export default function App() {
  // Load alarms from LocalStorage
  const [alarms, setAlarms] = useState<Alarm[]>(() => {
    try {
      const saved = localStorage.getItem('smart_alarm_list');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignore
    }
    return DEFAULT_ALARMS;
  });

  const [activeTab, setActiveTab] = useState<TabType>('alarms');
  const [isAlarmModalOpen, setIsAlarmModalOpen] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<Alarm | null>(null);
  const [ringingAlarm, setRingingAlarm] = useState<Alarm | null>(null);
  const [isAPKModalOpen, setIsAPKModalOpen] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);

  // Keep track of triggered minutes to prevent double trigger in the same 60 seconds
  const lastTriggeredMinuteRef = useRef<string>('');

  // Persist alarms
  useEffect(() => {
    try {
      localStorage.setItem('smart_alarm_list', JSON.stringify(alarms));
    } catch {
      // Ignore
    }
  }, [alarms]);

  // Check notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsGranted(Notification.permission === 'granted');
    }
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotificationsGranted(perm === 'granted');
    }
  };

  // Alarm background clock watcher
  useEffect(() => {
    const checkAlarms = () => {
      const now = new Date();
      const currentH = now.getHours().toString().padStart(2, '0');
      const currentM = now.getMinutes().toString().padStart(2, '0');
      const currentHM = `${currentH}:${currentM}`;
      const currentDay = now.getDay();
      const todayDateStr = now.toISOString().split('T')[0];

      // Key to avoid firing multiple times in same minute
      const minuteKey = `${todayDateStr}-${currentHM}`;
      if (lastTriggeredMinuteRef.current === minuteKey) {
        return;
      }

      alarms.forEach((alarm) => {
        if (!alarm.enabled) return;

        // Check time match
        if (alarm.time === currentHM) {
          // Check day match
          const matchesDay =
            alarm.days.length === 0 || alarm.days.includes(currentDay);

          if (matchesDay && alarm.lastDismissedDate !== todayDateStr) {
            lastTriggeredMinuteRef.current = minuteKey;
            triggerAlarm(alarm);
          }
        }
      });
    };

    const interval = setInterval(checkAlarms, 1000);
    return () => clearInterval(interval);
  }, [alarms]);

  const triggerAlarm = (alarm: Alarm) => {
    setRingingAlarm(alarm);
    startAlarmPlayback(alarm.sound, alarm.volume, alarm.vibrate);

    // Trigger Notification if allowed
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`⏰ ${alarm.label || 'حان وقت الاستيقاظ!'}`, {
          body: `الساعة الآن ${alarm.time}. انقر لإيقاف المنبه أو أخذ غفوة.`,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
        });
      } catch {
        // Ignore
      }
    }
  };

  // Test alarm immediate trigger for testing
  const handleQuickTestAlarm = () => {
    const testAlarm: Alarm = {
      id: 'test-instant',
      time: new Date().toTimeString().slice(0, 5),
      label: 'تجربة المنبه الحي',
      enabled: true,
      days: [],
      sound: 'energetic',
      volume: 0.9,
      snoozeMinutes: 5,
      challenge: 'math',
      vibrate: true,
      createdAt: Date.now(),
    };
    triggerAlarm(testAlarm);
  };

  const handleDismissAlarm = () => {
    stopAlarmPlayback();
    if (ringingAlarm) {
      const todayDateStr = new Date().toISOString().split('T')[0];
      // If one-time alarm, disable it
      if (ringingAlarm.days.length === 0) {
        setAlarms((prev) =>
          prev.map((a) =>
            a.id === ringingAlarm.id
              ? { ...a, enabled: false, lastDismissedDate: todayDateStr }
              : a
          )
        );
      } else {
        setAlarms((prev) =>
          prev.map((a) =>
            a.id === ringingAlarm.id
              ? { ...a, lastDismissedDate: todayDateStr }
              : a
          )
        );
      }
    }
    setRingingAlarm(null);
  };

  const handleSnoozeAlarm = (minutes: number) => {
    stopAlarmPlayback();
    const alarmToSnooze = ringingAlarm;
    setRingingAlarm(null);

    if (alarmToSnooze) {
      // Schedule snooze
      setTimeout(() => {
        triggerAlarm({
          ...alarmToSnooze,
          label: `(غفوة) ${alarmToSnooze.label}`,
        });
      }, minutes * 60 * 1000);
    }
  };

  const handleToggleAlarm = (id: string) => {
    setAlarms((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  };

  const handleDeleteAlarm = (id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSaveAlarm = (
    alarmData: Omit<Alarm, 'id' | 'createdAt'>,
    editingId?: string
  ) => {
    if (editingId) {
      setAlarms((prev) =>
        prev.map((a) =>
          a.id === editingId ? { ...a, ...alarmData } : a
        )
      );
    } else {
      const newAlarm: Alarm = {
        ...alarmData,
        id: `alarm-${Date.now()}`,
        createdAt: Date.now(),
      };
      setAlarms((prev) => [newAlarm, ...prev]);
    }
    setEditingAlarm(null);
  };

  const activeAlarmsCount = alarms.filter((a) => a.enabled).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* Offline Status */}
      <OfflineIndicator />

      {/* Main App Header */}
      <Header onOpenAPKModal={() => setIsAPKModalOpen(true)} />

      {/* Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-28">
        {/* Alarms Tab */}
        {activeTab === 'alarms' && (
          <div className="space-y-6">
            {/* Top Row: Add button & APK banner */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-white">قائمة المنبهات</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  لديك {activeAlarmsCount} منبه مفعّل حالياً
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="quick-test-alarm-btn"
                  onClick={handleQuickTestAlarm}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-amber-400 text-xs font-bold transition"
                  title="تجربة فورية لشاشة رنين المنبه والتحدي الحسابي"
                >
                  <Play className="w-3.5 h-3.5 fill-amber-400" />
                  تجربة المنبه
                </button>

                <button
                  id="add-new-alarm-btn"
                  onClick={() => {
                    setEditingAlarm(null);
                    setIsAlarmModalOpen(true);
                  }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition active:scale-98"
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                  إضافة منبه
                </button>
              </div>
            </div>

            {/* APK Promo Banner Card */}
            <div
              onClick={() => setIsAPKModalOpen(true)}
              className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 cursor-pointer hover:border-amber-500/60 transition group flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    هل تريد تثبيت المنبه كتطبيق APK على هاتفك؟
                    <span className="text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded font-bold">
                      APK
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    يعمل دون إنترنت (Offline)، شاشة كاملة، نغمات قوية، واستهلاك بطارية معدوم.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-400 shrink-0 hidden sm:inline-block">
                تحميل وتثبيت ←
              </span>
            </div>

            {/* Notification Permission Prompt if needed */}
            {!notificationsGranted && 'Notification' in window && (
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-300">
                  فعل إذن الإشعارات لتلقي تنبيهات المنبه حتى عند قفل الشاشة:
                </span>
                <button
                  id="request-notification-btn"
                  onClick={requestNotificationPermission}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold border border-amber-500/30 transition shrink-0"
                >
                  تفعيل الإشعارات
                </button>
              </div>
            )}

            {/* Alarms List */}
            {alarms.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800/80 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/60 text-slate-500 flex items-center justify-center mb-4">
                  <Bell className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-200">لا توجد منبهات حالياً</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  أضف منبهك الأول للاستيقاظ لصلاة الفجر، الدوام، أو المواعيد الهامة.
                </p>
                <button
                  onClick={() => {
                    setEditingAlarm(null);
                    setIsAlarmModalOpen(true);
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
                >
                  + إضافة منبه جديد
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {alarms.map((alarm) => (
                  <AlarmCard
                    key={alarm.id}
                    alarm={alarm}
                    onToggle={handleToggleAlarm}
                    onEdit={(a) => {
                      setEditingAlarm(a);
                      setIsAlarmModalOpen(true);
                    }}
                    onDelete={handleDeleteAlarm}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Clock Tab */}
        {activeTab === 'clock' && (
          <ClockView
            alarms={alarms}
            onOpenNewAlarm={() => {
              setEditingAlarm(null);
              setIsAlarmModalOpen(true);
            }}
          />
        )}

        {/* Timer Tab */}
        {activeTab === 'timer' && <TimerView />}

        {/* Stopwatch Tab */}
        {activeTab === 'stopwatch' && <StopwatchView />}

        {/* Relax Sounds Tab */}
        {activeTab === 'relax' && <RelaxSoundsView />}
      </main>

      {/* Bottom Sticky Navigation */}
      <Navigation
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        activeAlarmsCount={activeAlarmsCount}
      />

      {/* Alarm Create/Edit Modal */}
      <AlarmModal
        isOpen={isAlarmModalOpen}
        onClose={() => {
          setIsAlarmModalOpen(false);
          setEditingAlarm(null);
        }}
        onSave={handleSaveAlarm}
        editingAlarm={editingAlarm}
      />

      {/* Ringing Alarm Modal (Wakeup Screen) */}
      {ringingAlarm && (
        <RingingAlarmModal
          alarm={ringingAlarm}
          onDismiss={handleDismissAlarm}
          onSnooze={handleSnoozeAlarm}
        />
      )}

      {/* APK & PWA Install Modal */}
      <PWAInstallModal
        isOpen={isAPKModalOpen}
        onClose={() => setIsAPKModalOpen(false)}
      />
    </div>
  );
}
