import { NextResponse } from 'next/server';
import { generateTriageQuestions } from '@/lib/triage-agent';
import type { WeeklyReviewData } from '@/app/api/checkin/review/route';
import type { CheckinSubjectiveData } from '@/lib/types';

export interface TriageRequestBody {
  reviewData: WeeklyReviewData;
  subjectiveData: CheckinSubjectiveData;
}

export async function POST(request: Request) {
  let body: TriageRequestBody;

  try {
    body = (await request.json()) as TriageRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.reviewData || !body.subjectiveData) {
    return NextResponse.json(
      { error: 'Missing required fields: reviewData and subjectiveData' },
      { status: 400 }
    );
  }

  try {
    const questions = await generateTriageQuestions(body.reviewData, body.subjectiveData);
    return NextResponse.json({ questions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[triage] Failed to generate questions:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
