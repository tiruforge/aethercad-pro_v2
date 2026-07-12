// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('signup'); // 'signup' or 'login'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // User Profile Data state
  const [profile, setProfile] = useState({ name: '', age: 20, profession: '' });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Cloud CAD Projects list state
  const [projects, setProjects] = useState([]);
  const [isFetchingProjects, setIsFetchingProjects] = useState(false);

  // 1. On Mount: Listen to Auth States and fetch active sessions
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
        fetchUserProjects(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
        fetchUserProjects(session.user.id);
      } else {
        // Reset state on sign out
        setProfile({ name: '', age: 20, profession: '' });
        setProjects([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Control Layout Visibility (Hides `#app` when logged out, reveals when authorized)
  useEffect(() => {
    const isAuthorized = !!user;
    const styleId = 'aether-gatekeeper-styles';
    let styleTag = document.getElementById(styleId);

    if (isAuthorized) {
      if (styleTag) styleTag.remove();
      document.body.classList.remove('aether-gated');
    } else {
      document.body.classList.add('aether-gated');
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        styleTag.innerHTML = `
          body.aether-gated > *:not(#root) {
            display: none !important;
          }
          body.aether-gated {
            background-color: #0c0d12 !important;
            overflow: hidden !important;
          }
        `;
        document.head.appendChild(styleTag);
      }
    }
  }, [user]);

  // Fetch or Auto-Create User Profile Profile data
  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist yet, insert a default profile row
        const defaultProfile = { 
          id: userId, 
          name: email ? email.split('@')[0] : 'CAD Engineer', 
          age: 21, 
          profession: 'Engineering Student' 
        };
        await supabase.from('profiles').insert([defaultProfile]);
        setProfile(defaultProfile);
      } else if (data) {
        setProfile(data);
      }
    } catch (err) {
      console.error("Error retrieving user profile:", err);
    }
  };

  // Fetch Saved Projects using precise custom schema structure
  const fetchUserProjects = async (userId) => {
    setIsFetchingProjects(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, units, outer_width, outer_height, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setProjects(data);
    } catch (err) {
      console.error("Error loading blueprint directory:", err);
    } finally {
      setIsFetchingProjects(false);
    }
  };

  // Save changes to User Profile DB fields
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name: profile.name,
          age: parseInt(profile.age) || 20,
          profession: profile.profession,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
      alert("Engineer identity database updated! 📐");
    } catch (err) {
      alert(`Error updating profile: ${err.message}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Authenticate user session (Sign Up / Sign In via standard credentials)
  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');

    try {
      if (activeTab === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data?.user) {
          // Instantly write their basic profile credentials record
          await supabase.from('profiles').insert([
            { 
              id: data.user.id, 
              name: email.split('@')[0], 
              age: 21, 
              profession: 'Student / Engineer' 
            }
          ]);
          alert("Registration complete! Welcome to AetherCAD Pro! 🎉");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auth using Google Social OAuth Identity provider
  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
      if (error) throw error;
    } catch (err) {
      alert(`Google Auth Failed: ${err.message}`);
    }
  };

  // Kill Session & log out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsProfileModalOpen(false);
  };

  // Extract from CAD canvas layout and push project onto DB matching exact column schema
  const saveCurrentCADProject = async () => {
    if (!window.exportCADProject) {
      alert("CAD engine core is initializing. Wait a moment and retry!");
      return;
    }

    const cadData = window.exportCADProject();
    if (!cadData) {
      alert("No design drawings/shapes found on the canvas to save!");
      return;
    }

    const projName = prompt("Name your floorplan project:", "My Saved Floorplan");
    if (!projName) return;

    try {
      // Direct column-to-column map to your custom SQL schema definition
      const { error } = await supabase.from('projects').insert([
        {
          user_id: user.id,
          name: projName,
          units: cadData.units || 'ft',
          outer_width: parseFloat(cadData.outer_width) || 30,
          outer_height: parseFloat(cadData.outer_height) || 40,
          shapes: cadData.shapes || []
        }
      ]);

      if (error) throw error;
      alert("Design saved successfully to the cloud database! ☁️");
      fetchUserProjects(user.id);
    } catch (err) {
      alert(`Failed to save to cloud: ${err.message}`);
    }
  };

  // Retrieve Saved Layout data and write back to legacy script Canvas array
  const loadSavedCADProject = async (projectId) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      if (data && window.importCADProject) {
        // Send fields back to our canvas engine handler
        window.importCADProject({
          shapes: data.shapes,
          units: data.units,
          outer_width: data.outer_width,
          outer_height: data.outer_height
        });
        setIsProfileModalOpen(false);
        alert("CAD workspace design imported! 🛠️");
      } else {
        alert("The CAD Canvas engine could not receive this data payload.");
      }
    } catch (err) {
      alert(`Failed to import blueprint: ${err.message}`);
    }
  };

  // Delete project from database records
  const deleteSavedCADProject = async (projectId, e) => {
    e.stopPropagation(); // Avoid triggering project load on click
    if (!confirm("Are you sure you want to delete this blueprint design permanently from the cloud?")) return;
    try {
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
      setProjects(projects.filter(p => p.id !== projectId));
    } catch (err) {
      alert(`Error deleting database object: ${err.message}`);
    }
  };

  const isUnlocked = !!user;

  return (
    <>
      {isUnlocked ? (
        /* FLOATING PROFILE BUTTON (Neat engineering glassmorphism styling, absolute top-right) */
        <div style={{ zIndex: 9999 }} className="fixed top-2 right-4 flex items-center gap-3">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-2.5 bg-[#181A1F]/90 hover:bg-[#20232B] border border-[#2A2D35] rounded-md px-3 py-1.5 shadow-lg shadow-black/40 transition-all hover:scale-[1.02]"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <span className="text-[11px] font-mono font-bold tracking-wider text-gray-200 uppercase">
              {profile.name || user.email.split('@')[0]}
            </span>
          </button>
        </div>
      ) : (
        /* THE STUNNING AND ANIMATED BLUEPRINT SIGN-UP PORTAL */
        <div className="fixed inset-0 bg-[#0c0d12] flex items-center justify-center p-4 overflow-y-auto font-sans">
          
          {/* Engineering Glowing Grid Backdrop Lines */}
          <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={{
            backgroundImage: `
              radial-gradient(#3b82f6 1px, transparent 1.5px), 
              linear-gradient(to right, #1d4ed8 0.5px, transparent 0.5px), 
              linear-gradient(to bottom, #1d4ed8 0.5px, transparent 0.5px)
            `,
            backgroundSize: '40px 40px, 40px 40px, 40px 40px',
            backgroundPosition: '0 0, 20px 20px, 20px 20px'
          }}></div>
          
          {/* Glowing blue structural aura in background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>

          {/* Centered Modal Card */}
          <div className="bg-[#11131a]/95 border border-blue-500/20 backdrop-blur-xl rounded-2xl max-w-md w-full p-8 shadow-2xl relative z-10 my-auto transform transition-all">
            
            {/* Logo and App Title */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-blue-950/40 border border-blue-500/40 text-blue-400 text-3xl mb-3 shadow-lg shadow-blue-500/10">
                🏗️
              </div>
              <h1 className="text-2xl font-black text-white tracking-widest uppercase">AetherCAD Pro</h1>
              <p className="text-[9px] text-blue-400 font-mono tracking-widest uppercase mt-0.5">Automated Civil Engineering Workbench</p>
            </div>

            {/* Navigation Tab Selectors */}
            <div className="flex border-b border-[#2A2D35] mb-6">
              <button
                type="button"
                onClick={() => { setActiveTab('signup'); setAuthError(''); }}
                className={`flex-1 pb-3 text-xs font-black uppercase tracking-wider transition-all text-center border-b-2 ${activeTab === 'signup' ? 'text-blue-500 border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('login'); setAuthError(''); }}
                className={`flex-1 pb-3 text-xs font-black uppercase tracking-wider transition-all text-center border-b-2 ${activeTab === 'login' ? 'text-blue-500 border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
              >
                Sign In
              </button>
            </div>

            {/* OAuth Quick Google Access */}
            <button
              onClick={handleGoogleLogin}
              type="button"
              className="w-full flex items-center justify-center gap-3 bg-[#08090d] hover:bg-[#141722] border border-[#222530] text-white font-bold text-xs rounded-xl py-3 transition-all shadow-md cursor-pointer hover:border-blue-500/30"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.18 1-.78 1.85-1.63 2.42v2.77h2.63c1.63-1.5 2.58-3.71 2.58-5.22z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-2.63-2.77c-.73.49-1.66.78-2.65.78-2.04 0-3.77-1.38-4.38-3.23H6.97v2.85C8.79 21.05 11.19 23 12 23z" fill="#34A853"/>
                <path d="M7.62 15.12c-.15-.49-.24-1-.24-1.52s.09-1.03.24-1.52V9.23H4.34C3.47 10.97 3 11.97 3 13.6c0 1.63.47 2.63 1.34 4.37l3.28-2.85z" fill="#FBBC05"/>
                <path d="M12 7.64c1.62 0 3.07.56 4.21 1.66l3.15-3.15C17.45 4.31 14.96 3.32 12 3.32 8.79 3.32 6.39 5.27 4.34 7.21l3.28 2.85c.61-1.85 2.34-3.23 4.38-3.23z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            {/* Divider lines */}
            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-[#2a2e3d]"></div>
              <span className="text-[8px] text-slate-500 uppercase font-mono px-3 tracking-widest">or use work email</span>
              <div className="flex-1 border-t border-[#2a2e3d]"></div>
            </div>

            {/* Registration/Login input form */}
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1 tracking-wider">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="engineer@academy.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#08090d] border border-[#222530] focus:border-blue-500 rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-700 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1 tracking-wider">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#08090d] border border-[#222530] focus:border-blue-500 rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-700 focus:outline-none transition-all"
                />
              </div>

              {authError && (
                <div className="p-3 bg-red-950/30 border border-red-900/40 text-red-400 rounded-lg text-xs font-mono">
                  ⚠️ {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl py-3 shadow-lg shadow-blue-500/10 transition-all cursor-pointer"
              >
                {loading ? "Authorizing Profile..." : activeTab === 'signup' ? "Initialize My Account" : "Access Workbench"}
              </button>
            </form>

            {/* Bottom Swapper Link */}
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setActiveTab(activeTab === 'signup' ? 'login' : 'signup');
                  setAuthError('');
                }}
                className="text-xs text-slate-400 hover:text-blue-400 font-semibold underline transition-all"
              >
                {activeTab === 'signup' ? "Already have an account? Sign In →" : "Don't have an account? Sign Up →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE PROFILE & PROJECT CONTROL CENTER MODAL */}
      {isProfileModalOpen && (
        <div style={{ zIndex: 100000 }} className="fixed inset-0 bg-[#08090d]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11131a] border border-[#2A2D35] rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            
            {/* Exit Close Cross */}
            <button
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white font-bold text-base cursor-pointer"
            >
              ✕
            </button>

            <h2 className="text-sm font-black text-white uppercase tracking-wider border-b border-[#2A2D35] pb-3 mb-6 flex items-center gap-2">
              🏗️ Civil Engineer Control Center
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* SECTION A: PROFILE IDENTIFICATION FORM */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-4">Engineer Credentials</h3>
                
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      className="w-full bg-[#08090d] border border-[#222530] focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Age</label>
                    <input
                      type="number"
                      required
                      value={profile.age}
                      onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                      className="w-full bg-[#08090d] border border-[#222530] focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Profession / Specialty</label>
                    <input
                      type="text"
                      required
                      value={profile.profession}
                      placeholder="e.g. Civil Engineering Student"
                      onChange={(e) => setProfile({ ...profile, profession: e.target.value })}
                      className="w-full bg-[#08090d] border border-[#222530] focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2 rounded-lg transition-all cursor-pointer"
                  >
                    {isSavingProfile ? "Syncing Database..." : "Update Identity Data"}
                  </button>
                </form>

                <div className="mt-8 pt-4 border-t border-[#2A2D35]">
                  <button
                    onClick={handleSignOut}
                    className="w-full bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/40 text-rose-400 font-bold text-xs py-2 rounded-lg transition-all cursor-pointer"
                  >
                    Sign Out & Close Workspace
                  </button>
                </div>
              </div>

              {/* SECTION B: CLOUD BLUEPRINTS MANAGER (Directly maps to table projects) */}
              <div className="border-t md:border-t-0 md:border-l border-[#2A2D35] md:pl-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">Database Drawings</h3>
                  <button
                    onClick={saveCurrentCADProject}
                    className="bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono px-2.5 py-1 rounded transition-all cursor-pointer"
                  >
                    + Save Design
                  </button>
                </div>

                {isFetchingProjects ? (
                  <p className="text-xs font-mono text-slate-500">Querying project index...</p>
                ) : projects.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-[#2A2D35] rounded-xl">
                    <p className="text-xs text-slate-500">No cloud drawings saved.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        onClick={() => loadSavedCADProject(project.id)}
                        className="flex items-center justify-between p-3 bg-[#08090d] hover:bg-[#141722] border border-[#222530] hover:border-[#2A2D35] rounded-lg cursor-pointer transition-all group"
                      >
                        <div className="truncate pr-4">
                          <p className="text-xs font-bold text-gray-200 group-hover:text-blue-400 transition-all truncate">
                            {project.name}
                          </p>
                          <p className="text-[9px] font-mono text-slate-500 mt-0.5">
                            Size: {project.outer_width}x{project.outer_height} {project.units} • {new Date(project.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={(e) => deleteSavedCADProject(project.id, e)}
                          className="text-[9px] text-rose-400 hover:text-rose-300 px-2 py-0.5 bg-rose-950/20 hover:bg-rose-950/40 rounded border border-rose-900/30 transition-all opacity-0 group-hover:opacity-100"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}