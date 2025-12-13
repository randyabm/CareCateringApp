'use client';

import { createClient } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';

export default function TestSupabase() {
    const [status, setStatus] = useState<string>('Testing connection...');
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const runTest = async () => {
            try {
                const supabase = createClient();
                console.log('Supabase client created:', supabase);

                // Just check if we can get the session (even if null, it means we connected)
                const { data, error } = await supabase.auth.getSession();

                if (error) {
                    setStatus('Error connecting: ' + error.message);
                    console.error(error);
                } else {
                    setStatus('Connection successful! Session data retrieved.');
                    console.log('Session:', data);
                    setUser(data.session?.user || 'No active session');
                }
            } catch (err: any) {
                setStatus('Exception: ' + err.message);
                console.error(err);
            }
        };

        runTest();
    }, []);

    return (
        <div className="p-8 font-sans">
            <h1 className="text-2xl font-bold mb-4">Supabase Connection Test</h1>
            <div className="p-4 border rounded bg-gray-50 text-black">
                <p className="font-semibold">Status:</p>
                <p>{status}</p>
                <div className="mt-4">
                    <p className="font-semibold">User Info:</p>
                    <pre className="text-sm bg-gray-200 p-2 rounded mt-2">
                        {JSON.stringify(user, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    );
}
