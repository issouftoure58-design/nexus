/**
 * Onboarding Enrollment Service
 * Tracker leger pour les sequences d'onboarding post-paiement
 */

import { supabase } from '../config/supabase.js';

/**
 * Cree un enrollment d'onboarding
 */
export async function createEnrollment(tenantId, { workflowId, clientEmail, clientName, totalSteps = 3, metadata = {} }) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!clientEmail) throw new Error('client_email requis');

  const { data, error } = await supabase
    .from('onboarding_enrollments')
    .insert({
      tenant_id: tenantId,
      workflow_id: workflowId || null,
      client_email: clientEmail,
      client_name: clientName || null,
      total_steps: totalSteps,
      metadata,
      status: 'active',
      current_step: 0,
      steps_completed: [],
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  console.log(`[ONBOARDING] Enrollment cree: ${data.id} pour ${clientEmail} (tenant: ${tenantId})`);
  return data;
}

/**
 * Avance d'une etape dans l'enrollment
 */
export async function advanceStep(tenantId, enrollmentId, stepData = {}) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!enrollmentId) throw new Error('enrollment_id requis');

  const { data: enrollment, error: getError } = await supabase
    .from('onboarding_enrollments')
    .select('*')
    .eq('id', enrollmentId)
    .eq('tenant_id', tenantId)
    .single();

  if (getError || !enrollment) throw new Error('Enrollment introuvable');
  if (enrollment.status !== 'active') throw new Error('Enrollment non actif');

  const newStep = enrollment.current_step + 1;
  const stepsCompleted = [...(enrollment.steps_completed || []), {
    step: newStep,
    ...stepData,
    completed_at: new Date().toISOString(),
  }];

  const isComplete = newStep >= enrollment.total_steps;

  const { data, error } = await supabase
    .from('onboarding_enrollments')
    .update({
      current_step: newStep,
      steps_completed: stepsCompleted,
      ...(isComplete ? { status: 'completed', completed_at: new Date().toISOString() } : {}),
    })
    .eq('id', enrollmentId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;

  console.log(`[ONBOARDING] Enrollment ${enrollmentId} -> etape ${newStep}/${enrollment.total_steps}${isComplete ? ' (COMPLETE)' : ''}`);
  return data;
}

/**
 * Complete un enrollment manuellement
 */
export async function completeEnrollment(tenantId, enrollmentId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error } = await supabase
    .from('onboarding_enrollments')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Annule un enrollment
 */
export async function cancelEnrollment(tenantId, enrollmentId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error } = await supabase
    .from('onboarding_enrollments')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Relance un enrollment echoue
 */
export async function retryEnrollment(tenantId, enrollmentId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error } = await supabase
    .from('onboarding_enrollments')
    .update({
      status: 'active',
      completed_at: null,
    })
    .eq('id', enrollmentId)
    .eq('tenant_id', tenantId)
    .in('status', ['failed', 'cancelled'])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Marque un enrollment comme echoue
 */
export async function failEnrollment(tenantId, enrollmentId, reason = '') {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data: enrollment } = await supabase
    .from('onboarding_enrollments')
    .select('metadata')
    .eq('id', enrollmentId)
    .eq('tenant_id', tenantId)
    .single();

  const { data, error } = await supabase
    .from('onboarding_enrollments')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      metadata: { ...(enrollment?.metadata || {}), failure_reason: reason },
    })
    .eq('id', enrollmentId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Liste les enrollments avec pagination et filtres
 */
export async function getEnrollments(tenantId, { status, page = 1, limit = 20 } = {}) {
  if (!tenantId) throw new Error('tenant_id requis');

  const offset = (page - 1) * limit;

  let query = supabase
    .from('onboarding_enrollments')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    data: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      pages: Math.ceil((count || 0) / limit),
    },
  };
}

/**
 * Stats des enrollments par statut
 */
export async function getEnrollmentStats(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [activeRes, completedRes, failedRes, cancelledRes, completedMonthRes] = await Promise.all([
    supabase
      .from('onboarding_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
    supabase
      .from('onboarding_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'completed'),
    supabase
      .from('onboarding_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'failed'),
    supabase
      .from('onboarding_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'cancelled'),
    supabase
      .from('onboarding_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .gte('completed_at', startOfMonth.toISOString()),
  ]);

  const active = activeRes.count || 0;
  const completed = completedRes.count || 0;
  const failed = failedRes.count || 0;
  const cancelled = cancelledRes.count || 0;
  const completedThisMonth = completedMonthRes.count || 0;
  const total = active + completed + failed + cancelled;

  return {
    active,
    completed,
    failed,
    cancelled,
    completed_this_month: completedThisMonth,
    total,
    completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export default {
  createEnrollment,
  advanceStep,
  completeEnrollment,
  cancelEnrollment,
  retryEnrollment,
  failEnrollment,
  getEnrollments,
  getEnrollmentStats,
};
