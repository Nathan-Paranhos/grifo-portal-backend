// Load environment variables FIRST
const dotenv = require('dotenv');
const path = require('path');

const { createClient } = require('@supabase/supabase-js');

// const { logger } = require('../config/logger'); // Temporarily removed to fix circular dependency

// Load .env from api root directory
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// Supabase configuration
const supabaseUrl =
  process.env.SUPABASE_URL || 'https://fsvwifbvehdhlufauahj.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdndpZmJ2ZWhkaGx1ZmF1YWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MjI1MDYsImV4cCI6MjA3MDE5ODUwNn0.IC-I9QsH2t5o60v70TmzVFmfe8rUuFdMD5kMErQ4CPI';

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is required');
}

if (!supabaseServiceKey) {
  console.warn(
    'SUPABASE_SERVICE_ROLE_KEY not found, using anon key (limited functionality)'
  );
}

// Create Supabase client with service role key for backend operations
const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey || supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  }
);

// Create Supabase client with anon key for auth operations
const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true
  }
});

// Database helper functions
const db = {
  // Generic query with company isolation
  async query(table, options = {}) {
    const {
      companyId,
      select = '*',
      filters = {},
      orderBy,
      limit,
      offset
    } = options;

    let query = supabase.from(table).select(select);

    // Apply company isolation
    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });

    // Apply ordering
    if (orderBy) {
      const { column, ascending = true } = orderBy;
      query = query.order(column, { ascending });
    }

    // Apply pagination
    if (limit) {
      query = query.limit(limit);
    }
    if (offset) {
      query = query.range(offset, offset + (limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error(`Database query error on ${table}:`, error);
      throw error;
    }

    return { data, count };
  },

  // Insert with company isolation
  async insert(table, data, companyId) {
    const insertData = companyId ? { ...data, company_id: companyId } : data;

    const { data: result, error } = await supabase
      .from(table)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error(`Database insert error on ${table}:`, error);
      throw error;
    }

    return result;
  },

  // Update with company isolation
  async update(table, id, data, companyId) {
    let query = supabase
      .from(table)
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);

    // Apply company isolation
    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data: result, error } = await query.select().single();

    if (error) {
      console.error(`Database update error on ${table}:`, error);
      throw error;
    }

    return result;
  },

  // Delete with company isolation
  async delete(table, id, companyId) {
    let query = supabase.from(table).delete().eq('id', id);

    // Apply company isolation
    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { error } = await query;

    if (error) {
      console.error(`Database delete error on ${table}:`, error);
      throw error;
    }

    return true;
  },

  // Get single record with company isolation
  async findById(table, id, companyId, select = '*') {
    let query = supabase.from(table).select(select).eq('id', id);

    // Apply company isolation
    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found
      console.error(`Database findById error on ${table}:`, error);
      throw error;
    }

    return data;
  },

  // Execute raw SQL (use with caution)
  async raw(sql, params = []) {
    const { data, error } = await supabase.rpc('execute_sql', {
      sql_query: sql,
      params
    });

    if (error) {
      console.error('Raw SQL execution error:', error);
      throw error;
    }

    return data;
  }
};

// Storage helper functions
const storage = {
  // Upload file to Supabase Storage
  async upload(bucket, path, file, options = {}) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        ...options
      });

    if (error) {
      console.error('Storage upload error:', error);
      throw error;
    }

    return data;
  },

  // Get public URL for file
  getPublicUrl(bucket, path) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);

    return data.publicUrl;
  },

  // Delete file from storage
  async delete(bucket, paths) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .remove(Array.isArray(paths) ? paths : [paths]);

    if (error) {
      console.error('Storage delete error:', error);
      throw error;
    }

    return data;
  },

  // List files in bucket
  async list(bucket, path = '', options = {}) {
    const { data, error } = await supabase.storage.from(bucket).list(path, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
      ...options
    });

    if (error) {
      console.error('Storage list error:', error);
      throw error;
    }

    return data;
  }
};

// Test database connection
async function testConnection() {
  try {
    const { error } = await supabase.from('empresas').select('id').limit(1);

    if (error) {
      console.error('Database connection test failed:', error);
      return false;
    }

    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection test error:', error);
    return false;
  }
}

// Connection test function available for manual use
// testConnection() can be called manually when needed

module.exports = {
  supabase,
  supabaseAuth,
  db,
  storage,
  testConnection
};
