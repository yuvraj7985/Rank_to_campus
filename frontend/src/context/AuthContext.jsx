import{createContext,useContext,useEffect,useState}from'react';import api from'../services/api';
const Ctx=createContext(null);
export function AuthProvider({children}){const[user,setUser]=useState(null),[loading,setLoading]=useState(true);
 useEffect(()=>{if(localStorage.getItem('r2c_token'))api.get('/auth/me').then(r=>setUser(r.user)).catch(()=>{localStorage.removeItem('r2c_token');}).finally(()=>setLoading(false));else setLoading(false);},[]);
 const login=async(email,password)=>{const r=await api.post('/auth/login',{email,password});localStorage.setItem('r2c_token',r.token);setUser(r.user);return r.user;};
 const register=async(data)=>{const r=await api.post('/auth/register',data);localStorage.setItem('r2c_token',r.token);setUser(r.user);return r.user;};
 const logout=()=>{localStorage.removeItem('r2c_token');setUser(null);};
 return <Ctx.Provider value={{user,loading,login,register,logout}}>{children}</Ctx.Provider>;}
export const useAuth=()=>useContext(Ctx);
