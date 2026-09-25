// Tilo profile shell.
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  emptyImageSelection,
  ImagePicker,
  type ImageSelection,
} from '@/components/custom/image-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { signOut, useSession } from '@/lib/auth-client';
import { ProfileImageResult } from '@/lib/contracts/account';
import { compressImageFile } from '@/lib/image';
import { uploadImageFile } from '@/lib/uploads';

export default function ProfilePage() {
  const { data: session, isPending, refetch } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [avatar, setAvatar] = useState<ImageSelection>(emptyImageSelection);
  const [savingAvatar, setSavingAvatar] = useState(false);

  async function saveAvatar() {
    setSavingAvatar(true);
    try {
      if (avatar.file) {
        const compressed = await compressImageFile(avatar.file, 512, 0.85);
        await uploadImageFile(
          '/api/profile/image',
          compressed,
          avatar.file.name,
          ProfileImageResult,
        );
      } else if (avatar.cleared) {
        const res = await fetch('/api/profile/image', { method: 'DELETE' });
        if (!res.ok) throw new Error(`delete failed (${res.status})`);
      } else {
        return;
      }
      await refetch();
      setAvatar(emptyImageSelection);
      toast.success('Profile photo updated');
    } catch (error) {
      const message =
        error instanceof Error && error.cause
          ? ((error.cause as { error?: string }).error ?? 'Could not save your photo')
          : 'Could not save your photo';
      toast.error(message);
    } finally {
      setSavingAvatar(false);
    }
  }

  if (isPending) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-5 dark:bg-stone-950">
        <p className="animate-pulse text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Loading…
        </p>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-16 dark:bg-stone-950">
        <Card className="w-full max-w-md rounded-xl border border-border bg-card shadow-sm dark:bg-stone-900">
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-2xl font-bold">Sign in required</CardTitle>
            <CardDescription className="font-medium">
              Sign in to manage your profile
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Button
              asChild
              className="h-12 w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <a href="/login">Sign in</a>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="bg-background px-5 py-12 dark:bg-stone-950">
      <div className="relative mx-auto max-w-lg">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-6">
          {session.user.image ? (
            <img
              src={session.user.image}
              alt=""
              className="size-16 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-2xl font-bold text-primary">
              {session.user.name?.charAt(0).toUpperCase() ?? '?'}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{session.user.name}</h1>
            <p className="truncate text-sm font-medium text-muted-foreground">
              {session.user.phoneNumber ?? session.user.email}
            </p>
          </div>
        </div>

        <Card className="mt-5 rounded-xl border border-border bg-card shadow-sm dark:bg-stone-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold">Photo</CardTitle>
            <CardDescription className="font-medium">
              A face for your account — snap one or pick from your gallery.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ImagePicker
              shape="circle"
              currentUrl={session.user.image ?? null}
              value={avatar}
              onChange={setAvatar}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={savingAvatar || (!avatar.file && !avatar.cleared)}
                onClick={() => void saveAvatar()}
                className="h-10 rounded-md bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {savingAvatar ? 'Saving…' : 'Save photo'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-5 rounded-xl border border-border bg-card shadow-sm dark:bg-stone-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold">Account details</CardTitle>
            <CardDescription className="font-medium">Your details, on one card</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-semibold text-muted-foreground">Name</span>
              <span className="font-bold">{session.user.name}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-semibold text-muted-foreground">Phone</span>
              <span className="font-bold">{session.user.phoneNumber ?? '—'}</span>
            </div>
            {session.user.email && !session.user.email.endsWith('@phone.tilo') ? (
              <>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-semibold text-muted-foreground">Email</span>
                  <span className="font-bold">{session.user.email}</span>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end">
          <Button
            variant="outline"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              try {
                await signOut();
                window.location.assign('/login');
              } finally {
                setSigningOut(false);
              }
            }}
            className="rounded-md border-border font-semibold hover:bg-muted"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </div>
    </main>
  );
}
