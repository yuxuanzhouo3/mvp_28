  -- 创建缺失的 profiles 表（与 Supabase 默认模板一致，可按需精简）                                                             
  create table if not exists public.profiles (                                                                                  
    id uuid primary key references auth.users on delete cascade,                                                                
    full_name text,                                                                                                             
    avatar_url text,                                                                                                            
    website text,                                                                                                               
    username text unique,                                                                                                       
    updated_at timestamptz default now()                                                                                        
  );                                                                                                                            
                                                                                                                                
  alter table public.profiles enable row level security;                                                                        
                                                                                                                                
  create policy "Profiles are viewable by everyone"                                                                             
    on public.profiles for select using (true);                                                                                 
                                                                                                                                
  create policy "Users can insert their own profile"                                                                            
    on public.profiles for insert with check (auth.uid() = id);                                                                 
                                                                                                                                
  create policy "Users can update their own profile"                                                                            
    on public.profiles for update using (auth.uid() = id);                                                                      
                                                                                                                                
  -- 重新创建新用户触发器                                                                                                       
  create or replace function public.handle_new_user()                                                                           
  returns trigger                                                                                                               
  language plpgsql                                                                                                              
  security definer                                                                                                              
  set search_path = public                                                                                                      
  as $$                                                                                                                         
  begin                                                                                                                         
    insert into public.profiles (id, full_name)                                                                                 
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''));                                                         
    return new;                                                                                                                 
  end;                                                                                                                          
  $$;                                                                                                                           
                                                                                                                                
  drop trigger if exists on_auth_user_created on auth.users;                                                                    
  create trigger on_auth_user_created                                                                                           
    after insert on auth.users                                                                                                  
    for each row execute procedure public.handle_new_user();