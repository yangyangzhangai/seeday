// DOC-DEPS: LLM.md -> src/store/README.md
import { supabase } from '../../api/supabase';

export interface FeedbackPayload {
  userId: string;
  email: string;
  subject: string;
  issueType: string;
  description: string;
}

export async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  const { error } = await supabase.from('user_feedback').insert({
    user_id: payload.userId,
    email: payload.email,
    subject: payload.subject,
    issue_type: payload.issueType,
    description: payload.description,
  });
  if (error) throw error;
}
