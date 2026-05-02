type GroupTriggerInput = {
  round: number;
  min_round?: number;
  unresolved_items?: string[];
  user_progress?: {
    final_plan_complete?: boolean;
    clarified_scope?: boolean;
    gave_risk_plan?: boolean;
    handled_coworker_conflict?: boolean;
    managed_client_expectation?: boolean;
  };
  latest_user_behavior?: {
    over_promise?: boolean;
    blame_shifting?: boolean;
    avoidance?: boolean;
    unsupported_assumption?: boolean;
  };
  group_discussion_summary?: Record<string, unknown>;
};

function getLatestGroupDiscussionRound(blackboard: GroupTriggerInput): number {
  const summary = blackboard.group_discussion_summary ?? {};

  return Object.keys(summary).reduce((latest, key) => {
    const match = /^round_(\d+)$/.exec(key);
    if (!match) {
      return latest;
    }

    const round = Number(match[1]);
    return Number.isFinite(round) && round > latest ? round : latest;
  }, 0);
}

function hasRecentGroupDiscussion(blackboard: GroupTriggerInput): boolean {
  const nextRound = blackboard.round + 1;
  const latestGroupRound = getLatestGroupDiscussionRound(blackboard);
  return latestGroupRound > 0 && nextRound - latestGroupRound <= 2;
}

export function shouldForceGroupDiscussion(blackboard: GroupTriggerInput): boolean {
  if (hasRecentGroupDiscussion(blackboard)) {
    return false;
  }

  const behavior = blackboard.latest_user_behavior ?? {};
  if (
    behavior.over_promise ||
    behavior.blame_shifting ||
    behavior.avoidance ||
    behavior.unsupported_assumption
  ) {
    return true;
  }

  const unresolvedCount = blackboard.unresolved_items?.length ?? 0;
  if (unresolvedCount >= 4) {
    return true;
  }

  const progress = blackboard.user_progress ?? {};
  const minRound = blackboard.min_round ?? 6;
  const isNearClosure = blackboard.round + 1 >= Math.max(1, Math.ceil(minRound / 2));
  return Boolean(isNearClosure && !progress.final_plan_complete);
}
