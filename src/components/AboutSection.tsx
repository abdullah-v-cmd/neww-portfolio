import { ProfileSettings } from '../types/portfolio';

interface AboutSectionProps {
  profile: ProfileSettings;
}

export function AboutSection({ profile }: AboutSectionProps) {
  return (
    <section id="about" className="mx-auto max-w-[1360px] px-6 py-20 lg:px-10">
      <div className="mb-10">
        <p className="text-[11px] font-semibold tracking-[0.26em] text-[#e50914] uppercase">
          The Cast
        </p>
        <h2 className="mt-1 font-display text-4xl font-bold tracking-wide text-white uppercase sm:text-5xl">
          About Me
        </h2>
      </div>

      {/* Video 1 Portrait + Video 2 Highlighted Pull-Quote */}
      <div className="grid grid-cols-1 items-center gap-10 rounded-xl border border-zinc-800/90 bg-[#0D0F14] p-6 sm:p-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover object-top"
              />
            ) : null}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0D0F14] via-transparent to-transparent" />
          </div>
        </div>

        <div className="space-y-6 lg:col-span-8">
          <blockquote className="text-xl font-medium leading-relaxed text-slate-200 sm:text-2xl">
            &ldquo;I focus on the parts of an AI system users rely on most:{' '}
            <span className="border-b-2 border-[#e50914] pb-0.5 text-white">
              the retrieval pipeline that stays grounded
            </span>
            ,{' '}
            <span className="border-b-2 border-blue-500 pb-0.5 text-white">
              the vision container that recovers itself
            </span>
            , and{' '}
            <span className="border-b-2 border-emerald-500 pb-0.5 text-white">
              the architecture you can inspect end to end
            </span>
            .&rdquo;
          </blockquote>

          <p className="text-sm leading-relaxed text-slate-400">{profile.bio_long}</p>

          <div className="grid grid-cols-1 gap-6 border-t border-zinc-800 pt-6 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold tracking-wider text-white uppercase">
                What I Build
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                {profile.about_what_i_build}
              </p>
            </div>
            <div>
              <h3 className="text-xs font-semibold tracking-wider text-white uppercase">
                Problem-Solving &amp; Goals
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                {profile.about_problem_solving} {profile.about_career_goals}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
