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
import { fitImageFile } from '@/lib/image';
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
        const compressed = await fitImageFile(avatar.file, 'avatar', 0.85);
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
      <main className="flex min-h-dvh items-center justify-center bg-background px-5">
        <p className="animate-pulse text-eyebrow">Loading…</p>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-16">
        <Card className="w-full max-w-md rounded-xl border border-border bg-card shadow-sm">
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-h4 font-display">Sign in required</CardTitle>
            <CardDescription>Sign in to manage your profile</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Button asChild className="h-11 w-full rounded-md font-semibold">
              <a href="/login">Sign in</a>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="bg-background px-5 py-12">
      <div className="relative mx-auto max-w-lg">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-6">
          {session.user.image ? (
            <img
              src={session.user.image}
              alt=""
              className="size-16 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-display text-h3 text-primary">
              {session.user.name?.charAt(0).toUpperCase() ?? '?'}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-h1 font-display">{session.user.name}</h1>
            <p className="truncate text-small text-muted-foreground">
              {session.user.phoneNumber ?? session.user.email}
            </p>
          </div>
        </div>

        <Card className="mt-5 rounded-xl border border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-h4 font-display">Photo</CardTitle>
            <CardDescription>
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
                className="h-9 rounded-md font-semibold"
              >
                {savingAvatar ? 'Saving…' : 'Save photo'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-5 rounded-xl border border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-h4 font-display">Account details</CardTitle>
            <CardDescription>Your details, on one card</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <div className="flex items-center justify-between py-2">
              <span className="text-caption font-medium text-muted-foreground">Name</span>
              <span className="font-medium">{session.user.name}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-caption font-medium text-muted-foreground">Phone</span>
              <span className="font-medium">{session.user.phoneNumber ?? '—'}</span>
            </div>
            {session.user.email && !session.user.email.endsWith('@phone.tilo') ? (
              <>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <span className="text-caption font-medium text-muted-foreground">Email</span>
                  <span className="font-medium">{session.user.email}</span>
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
            className="h-9 rounded-md font-semibold"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </div>
    </main>
  );
}
