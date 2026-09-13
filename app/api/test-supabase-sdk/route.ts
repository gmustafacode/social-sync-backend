import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET() {
    try {
        const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true })

        if (error) throw error;

        return Response.json({
            status: "Supabase SDK Connected ✅",
            message: "The Data API (HTTP) is working!",
            data
        });
    } catch (error: any) {
        return Response.json({
            status: "Supabase SDK Failed ❌",
            error: error.message,
            hint: "If this works but Prisma fails, your network is blocking the Postgres protocol (port 5432) but allowing HTTP (port 443)."
        }, { status: 500 });
    }
}
