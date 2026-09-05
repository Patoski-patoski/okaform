import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Okaform } from "../target/types/okaform";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";

describe("okaform-program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.okaform as Program<Okaform>;
  const creator = Keypair.generate();
  const respondent = Keypair.generate();

  const SURVEY_SEED = Buffer.from("survey");
  const ESCROW_SEED = Buffer.from("escrow");
  const TOKEN_ESCROW_SEED = Buffer.from("token_escrow");
  const PARTICIPANT_SEED = Buffer.from("participant");
  const SCORE_SEED = Buffer.from("score");

  const MIN_REWARD_POOL = 100_000_000;
  const MAX_REWARD_POOL = 1_000_000_000_000;

  async function airdrop(publicKey: PublicKey, amount: number) {
    const sig = await provider.connection.requestAirdrop(publicKey, amount);
    await provider.connection.confirmTransaction(sig);
  }

  function getSurveyPda(creatorPubkey: PublicKey, surveyId: Buffer): PublicKey {
    return PublicKey.findProgramAddressSync(
      [SURVEY_SEED, creatorPubkey.toBuffer(), surveyId],
      program.programId
    )[0];
  }

  function getEscrowPda(surveyPubkey: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [ESCROW_SEED, surveyPubkey.toBuffer()],
      program.programId
    )[0];
  }

  function getTokenEscrowPda(surveyPubkey: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [TOKEN_ESCROW_SEED, surveyPubkey.toBuffer()],
      program.programId
    );
  }

  function getParticipantPda(
    surveyPubkey: PublicKey,
    respondentPubkey: PublicKey
  ): PublicKey {
    return PublicKey.findProgramAddressSync(
      [PARTICIPANT_SEED, surveyPubkey.toBuffer(), respondentPubkey.toBuffer()],
      program.programId
    )[0];
  }

  function getScorePda(walletPubkey: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [SCORE_SEED, walletPubkey.toBuffer()],
      program.programId
    )[0];
  }

  before(async () => {
    await airdrop(creator.publicKey, 10 * LAMPORTS_PER_SOL);
    await airdrop(respondent.publicKey, 10 * LAMPORTS_PER_SOL);
  });

  describe("initialize_survey", () => {
    const surveyId = Buffer.from("test-survey-1");
    let surveyPda: PublicKey;
    let escrowPda: PublicKey;

    before(() => {
      surveyPda = getSurveyPda(creator.publicKey, surveyId);
      escrowPda = getEscrowPda(surveyPda);
    });

    it("initializes a survey with valid parameters", async () => {
      const rewardPool = 1 * LAMPORTS_PER_SOL;

      await program.methods
        .initializeSurvey(
          surveyId,
          new anchor.BN(rewardPool),
          { weighted: {} },
          100
        )
        .accountsPartial({
          signer: creator.publicKey,
          survey: surveyPda,
          escrowVault: escrowPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      const surveyAccount = await program.account.surveyAccount.fetch(
        surveyPda
      );

      expect(surveyAccount.creator.toString()).to.equal(
        creator.publicKey.toString()
      );
      expect(surveyAccount.rewardPool.toNumber()).to.equal(rewardPool);
      expect(surveyAccount.rewardType).to.deep.equal({ weighted: {} });
      expect(surveyAccount.maxResponses).to.equal(100);
      expect(surveyAccount.responseCount).to.equal(0);
      expect(surveyAccount.isActive).to.be.true;

      const escrowBalance = await provider.connection.getBalance(escrowPda);
      expect(escrowBalance).to.be.greaterThan(rewardPool);
    });

    it("fails when reward_pool is below minimum", async () => {
      const tooLowId = Buffer.from("too-low-survey");
      const tooLowSurveyPda = getSurveyPda(creator.publicKey, tooLowId);
      const tooLowEscrowPda = getEscrowPda(tooLowSurveyPda);

      try {
        await program.methods
          .initializeSurvey(
            tooLowId,
            new anchor.BN(MIN_REWARD_POOL - 1),
            { weighted: {} },
            50
          )
          .accountsPartial({
            signer: creator.publicKey,
            survey: tooLowSurveyPda,
            escrowVault: tooLowEscrowPda,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([creator])
          .rpc();

        expect.fail("Should have thrown InsufficientRewardPool error");
      } catch (err: any) {
        expect(err.toString()).to.contain("InsufficientRewardPool");
      }
    });

    it("fails when reward_pool exceeds maximum", async () => {
      const tooHighId = Buffer.from("too-high-survey");
      const tooHighSurveyPda = getSurveyPda(creator.publicKey, tooHighId);
      const tooHighEscrowPda = getEscrowPda(tooHighSurveyPda);

      try {
        await program.methods
          .initializeSurvey(
            tooHighId,
            new anchor.BN(MAX_REWARD_POOL + 1),
            { weighted: {} },
            50
          )
          .accountsPartial({
            signer: creator.publicKey,
            survey: tooHighSurveyPda,
            escrowVault: tooHighEscrowPda,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([creator])
          .rpc();

        expect.fail("Should have thrown ExcessiveRewardPool error");
      } catch (err: any) {
        expect(err.toString()).to.contain("ExcessiveRewardPool");
      }
    });

    it("accepts reward_pool at minimum boundary", async () => {
      const minId = Buffer.from("min-survey");
      const minSurveyPda = getSurveyPda(creator.publicKey, minId);
      const minEscrowPda = getEscrowPda(minSurveyPda);

      await program.methods
        .initializeSurvey(
          minId,
          new anchor.BN(MIN_REWARD_POOL),
          { weighted: {} },
          10
        )
        .accountsPartial({
          signer: creator.publicKey,
          survey: minSurveyPda,
          escrowVault: minEscrowPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      const surveyAccount = await program.account.surveyAccount.fetch(
        minSurveyPda
      );
      expect(surveyAccount.rewardPool.toNumber()).to.equal(MIN_REWARD_POOL);

      const escrowBalance = await provider.connection.getBalance(minEscrowPda);
      expect(escrowBalance).to.be.greaterThan(MIN_REWARD_POOL);
    });

    it("accepts reward_pool at maximum boundary", async () => {
      const maxId = Buffer.from("max-survey");
      const maxSurveyPda = getSurveyPda(creator.publicKey, maxId);
      const maxEscrowPda = getEscrowPda(maxSurveyPda);

      await airdrop(creator.publicKey, MAX_REWARD_POOL);

      await program.methods
        .initializeSurvey(
          maxId,
          new anchor.BN(MAX_REWARD_POOL),
          { luckyDraw: {} },
          1000
        )
        .accountsPartial({
          signer: creator.publicKey,
          survey: maxSurveyPda,
          escrowVault: maxEscrowPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      const surveyAccount = await program.account.surveyAccount.fetch(
        maxSurveyPda
      );
      expect(surveyAccount.rewardPool.toNumber()).to.equal(MAX_REWARD_POOL);
      expect(surveyAccount.rewardType).to.deep.equal({ luckyDraw: {} });
    });
  });

  describe("register_participant", () => {
    const surveyId = Buffer.from("participant-test-survey");
    let surveyPda: PublicKey;
    let participantPda: PublicKey;

    before(async () => {
      surveyPda = getSurveyPda(creator.publicKey, surveyId);
      participantPda = getParticipantPda(surveyPda, respondent.publicKey);

      await program.methods
        .initializeSurvey(
          surveyId,
          new anchor.BN(0.5 * LAMPORTS_PER_SOL),
          { weighted: {} },
          3
        )
        .accountsPartial({
          signer: creator.publicKey,
          survey: surveyPda,
          escrowVault: getEscrowPda(surveyPda),
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();
    });

    it("registers a participant successfully", async () => {
      await program.methods
        .registerParticipant(surveyId)
        .accountsPartial({
          creator: creator.publicKey,
          survey: surveyPda,
          participant: participantPda,
          respondent: respondent.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      const participantAccount = await program.account.participantEntry.fetch(
        participantPda
      );

      expect(participantAccount.survey.toString()).to.equal(
        surveyPda.toString()
      );
      expect(participantAccount.respondent.toString()).to.equal(
        respondent.publicKey.toString()
      );
      expect(participantAccount.hasSubmitted).to.be.false;
      expect(participantAccount.scoreWeight).to.equal(0);

      const surveyAccount = await program.account.surveyAccount.fetch(
        surveyPda
      );
      expect(surveyAccount.responseCount).to.equal(1);
    });

    it("increments response_count on registration", async () => {
      const respondent2 = Keypair.generate();
      await airdrop(respondent2.publicKey, 2 * LAMPORTS_PER_SOL);

      const participant2Pda = getParticipantPda(
        surveyPda,
        respondent2.publicKey
      );

      await program.methods
        .registerParticipant(surveyId)
        .accountsPartial({
          creator: creator.publicKey,
          survey: surveyPda,
          participant: participant2Pda,
          respondent: respondent2.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      const surveyAccount = await program.account.surveyAccount.fetch(
        surveyPda
      );
      expect(surveyAccount.responseCount).to.equal(2);
    });

    it("fails when max_responses is reached", async () => {
      const respondent3 = Keypair.generate();
      await airdrop(respondent3.publicKey, 2 * LAMPORTS_PER_SOL);

      const participant3Pda = getParticipantPda(
        surveyPda,
        respondent3.publicKey
      );

      await program.methods
        .registerParticipant(surveyId)
        .accountsPartial({
          creator: creator.publicKey,
          survey: surveyPda,
          participant: participant3Pda,
          respondent: respondent3.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      const respondent4 = Keypair.generate();
      await airdrop(respondent4.publicKey, 2 * LAMPORTS_PER_SOL);

      const participant4Pda = getParticipantPda(
        surveyPda,
        respondent4.publicKey
      );

      try {
        await program.methods
          .registerParticipant(surveyId)
          .accountsPartial({
            creator: creator.publicKey,
            survey: surveyPda,
            participant: participant4Pda,
            respondent: respondent4.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([creator])
          .rpc();

        expect.fail("Should have thrown MaxResponsesReached error");
      } catch (err: any) {
        expect(err.toString()).to.contain("MaxResponsesReached");
      }
    });

    it("fails when registering duplicate participant", async () => {
      const duplicateParticipantPda = getParticipantPda(
        surveyPda,
        respondent.publicKey
      );

      try {
        await program.methods
          .registerParticipant(surveyId)
          .accountsPartial({
            creator: creator.publicKey,
            survey: surveyPda,
            participant: duplicateParticipantPda,
            respondent: respondent.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([creator])
          .rpc();

        expect.fail("Should have thrown error for duplicate registration");
      } catch (err: any) {
        expect(err).to.exist;
      }
    });
  });

  describe("initialize_score_account", () => {
    const scoreWallet = Keypair.generate();
    let scorePda: PublicKey;
    const authority = (provider.wallet as anchor.Wallet).payer;

    before(async () => {
      await airdrop(scoreWallet.publicKey, 5 * LAMPORTS_PER_SOL);
      scorePda = getScorePda(scoreWallet.publicKey);
    });

    it("initializes a score account with default values", async () => {
      await program.methods
        .initializeScoreAccount()
        .accountsPartial({
          authority: authority.publicKey,
          wallet: scoreWallet.publicKey,
          scoreAccount: scorePda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      const scoreAccount = await program.account.respondentScoreAccount.fetch(
        scorePda
      );

      expect(scoreAccount.wallet.toString()).to.equal(
        scoreWallet.publicKey.toString()
      );
      expect(scoreAccount.globalScore).to.equal(0);
      expect(scoreAccount.surveysCompleted).to.equal(0);
      expect(scoreAccount.badgeTier).to.deep.equal({ ghost: {} });
    });

    it("fails when trying to initialize duplicate score account", async () => {
      try {
        await program.methods
          .initializeScoreAccount()
          .accountsPartial({
            authority: authority.publicKey,
            wallet: scoreWallet.publicKey,
            scoreAccount: scorePda,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([authority])
          .rpc();

        expect.fail("Should have thrown error for duplicate score account");
      } catch (err: any) {
        expect(err).to.exist;
      }
    });

    it("initializes score accounts for different wallets independently", async () => {
      const wallet2 = Keypair.generate();
      await airdrop(wallet2.publicKey, 5 * LAMPORTS_PER_SOL);

      const scorePda2 = getScorePda(wallet2.publicKey);

      await program.methods
        .initializeScoreAccount()
        .accountsPartial({
          authority: authority.publicKey,
          wallet: wallet2.publicKey,
          scoreAccount: scorePda2,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      const scoreAccount2 = await program.account.respondentScoreAccount.fetch(
        scorePda2
      );

      expect(scoreAccount2.wallet.toString()).to.equal(
        wallet2.publicKey.toString()
      );
      expect(scoreAccount2.globalScore).to.equal(0);
      expect(scoreAccount2.badgeTier).to.deep.equal({ ghost: {} });

      const scoreAccount1 = await program.account.respondentScoreAccount.fetch(
        scorePda
      );
      expect(scoreAccount1.wallet.toString()).to.equal(
        scoreWallet.publicKey.toString()
      );
    });
  });

  describe("update_score", () => {
    const scoreWallet = Keypair.generate();
    let scorePda: PublicKey;
    const authority = (provider.wallet as anchor.Wallet).payer;

    before(async () => {
      await airdrop(scoreWallet.publicKey, 5 * LAMPORTS_PER_SOL);
      scorePda = getScorePda(scoreWallet.publicKey);

      await program.methods
        .initializeScoreAccount()
        .accountsPartial({
          authority: authority.publicKey,
          wallet: scoreWallet.publicKey,
          scoreAccount: scorePda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
    });

    it("increases score with positive delta", async () => {
      await program.methods
        .updateScore(10)
        .accountsPartial({
          authority: authority.publicKey,
          scoreAccount: scorePda,
          wallet: scoreWallet.publicKey,
        })
        .signers([authority])
        .rpc();

      const scoreAccount = await program.account.respondentScoreAccount.fetch(
        scorePda
      );
      expect(scoreAccount.globalScore).to.equal(10);
      expect(scoreAccount.surveysCompleted).to.equal(1);
      expect(scoreAccount.badgeTier).to.deep.equal({ ghost: {} });
    });

    it("accumulates score across multiple calls", async () => {
      await program.methods
        .updateScore(20)
        .accountsPartial({
          authority: authority.publicKey,
          scoreAccount: scorePda,
          wallet: scoreWallet.publicKey,
        })
        .signers([authority])
        .rpc();

      const scoreAccount = await program.account.respondentScoreAccount.fetch(
        scorePda
      );
      expect(scoreAccount.globalScore).to.equal(30);
      expect(scoreAccount.surveysCompleted).to.equal(2);
      expect(scoreAccount.badgeTier).to.deep.equal({ cipher: {} });
    });

    it("decreases score with negative delta", async () => {
      await program.methods
        .updateScore(-5)
        .accountsPartial({
          authority: authority.publicKey,
          scoreAccount: scorePda,
          wallet: scoreWallet.publicKey,
        })
        .signers([authority])
        .rpc();

      const scoreAccount = await program.account.respondentScoreAccount.fetch(
        scorePda
      );
      expect(scoreAccount.globalScore).to.equal(25);
      expect(scoreAccount.surveysCompleted).to.equal(3);
      expect(scoreAccount.badgeTier).to.deep.equal({ ghost: {} });
    });

    it("clamps score at zero (never underflows)", async () => {
      await program.methods
        .updateScore(-100)
        .accountsPartial({
          authority: authority.publicKey,
          scoreAccount: scorePda,
          wallet: scoreWallet.publicKey,
        })
        .signers([authority])
        .rpc();

      const scoreAccount = await program.account.respondentScoreAccount.fetch(
        scorePda
      );
      expect(scoreAccount.globalScore).to.equal(0);
      expect(scoreAccount.badgeTier).to.deep.equal({ ghost: {} });
    });

    it("transitions through all badge tiers", async () => {
      const freshWallet = Keypair.generate();
      await airdrop(freshWallet.publicKey, 5 * LAMPORTS_PER_SOL);
      const freshPda = getScorePda(freshWallet.publicKey);

      await program.methods
        .initializeScoreAccount()
        .accountsPartial({
          authority: authority.publicKey,
          wallet: freshWallet.publicKey,
          scoreAccount: freshPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      const tiers: [number, object][] = [
        [10, { ghost: {} }],
        [20, { cipher: {} }],
        [25, { sentinel: {} }],
        [25, { oracle: {} }],
        [30, { sovereign: {} }],
      ];

      let cumulative = 0;
      for (const [delta, expectedTier] of tiers) {
        await program.methods
          .updateScore(delta)
          .accountsPartial({
            authority: authority.publicKey,
            scoreAccount: freshPda,
            wallet: freshWallet.publicKey,
          })
          .signers([authority])
          .rpc();

        cumulative += delta;
        const scoreAccount = await program.account.respondentScoreAccount.fetch(
          freshPda
        );
        expect(scoreAccount.globalScore).to.equal(cumulative);
        expect(scoreAccount.badgeTier).to.deep.equal(expectedTier);
      }
    });

    it("rejects unauthorized signer", async () => {
      const fakeAuthority = Keypair.generate();
      await airdrop(fakeAuthority.publicKey, 1 * LAMPORTS_PER_SOL);

      try {
        await program.methods
          .updateScore(5)
          .accountsPartial({
            authority: fakeAuthority.publicKey,
            scoreAccount: scorePda,
            wallet: scoreWallet.publicKey,
          })
          .signers([fakeAuthority])
          .rpc();

        expect.fail("Should have thrown Unauthorized error");
      } catch (err: any) {
        expect(err).to.exist;
      }
    });
  });

  describe("close_survey", () => {
    const creator = Keypair.generate();
    const surveyId = Buffer.from("close-test-survey");
    let surveyPda: PublicKey;

    before(async () => {
      await airdrop(creator.publicKey, 10 * LAMPORTS_PER_SOL);
      surveyPda = getSurveyPda(creator.publicKey, surveyId);

      await program.methods
        .initializeSurvey(
          surveyId,
          new anchor.BN(1 * LAMPORTS_PER_SOL),
          { weighted: {} },
          50
        )
        .accountsPartial({
          signer: creator.publicKey,
          survey: surveyPda,
          escrowVault: getEscrowPda(surveyPda),
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();
    });

    it("closes a survey and sets is_active to false", async () => {
      await program.methods
        .closeSurvey(surveyId)
        .accountsPartial({
          signer: creator.publicKey,
          survey: surveyPda,
        })
        .signers([creator])
        .rpc();

      const surveyAccount = await program.account.surveyAccount.fetch(
        surveyPda
      );
      expect(surveyAccount.isActive).to.be.false;
    });

    it("rejects closing an already closed survey", async () => {
      try {
        await program.methods
          .closeSurvey(surveyId)
          .accountsPartial({
            signer: creator.publicKey,
            survey: surveyPda,
          })
          .signers([creator])
          .rpc();

        expect.fail("Should have thrown SurveyAlreadyClosed error");
      } catch (err: any) {
        expect(err.toString()).to.contain("SurveyAlreadyClosed");
      }
    });

    it("rejects non-creator trying to close", async () => {
      const fakeCreator = Keypair.generate();
      await airdrop(fakeCreator.publicKey, 2 * LAMPORTS_PER_SOL);

      try {
        await program.methods
          .closeSurvey(surveyId)
          .accountsPartial({
            signer: fakeCreator.publicKey,
            survey: surveyPda,
          })
          .signers([fakeCreator])
          .rpc();

        expect.fail("Should have thrown Unauthorized error");
      } catch (err: any) {
        expect(err).to.exist;
      }
    });
  });

  describe("distribute_rewards", () => {
    const authority = (provider.wallet as anchor.Wallet).payer;

    it("distributes weighted rewards proportional to badge tier", async () => {
      const creator = Keypair.generate();
      await airdrop(creator.publicKey, 15 * LAMPORTS_PER_SOL);

      const r1 = Keypair.generate();
      await airdrop(r1.publicKey, 5 * LAMPORTS_PER_SOL);

      const surveyId = Buffer.from("dist-weighted");
      const surveyPda = getSurveyPda(creator.publicKey, surveyId);
      const escrowPda = getEscrowPda(surveyPda);
      const rewardPool = 5 * LAMPORTS_PER_SOL;

      await program.methods
        .initializeSurvey(
          surveyId,
          new anchor.BN(rewardPool),
          { weighted: {} },
          10
        )
        .accountsPartial({
          signer: creator.publicKey,
          survey: surveyPda,
          escrowVault: escrowPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      const scorePda = getScorePda(r1.publicKey);
      await program.methods
        .initializeScoreAccount()
        .accountsPartial({
          authority: authority.publicKey,
          wallet: r1.publicKey,
          scoreAccount: scorePda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      const pda1 = getParticipantPda(surveyPda, r1.publicKey);
      await program.methods
        .registerParticipant(surveyId)
        .accountsPartial({
          creator: creator.publicKey,
          survey: surveyPda,
          participant: pda1,
          respondent: r1.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      const balance1Before = await provider.connection.getBalance(r1.publicKey);

      const tx = await program.methods
        .distributeRewards(surveyId, [new anchor.BN(rewardPool)])
        .accountsPartial({
          creator: creator.publicKey,
          survey: surveyPda,
          escrowVault: escrowPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: r1.publicKey, isSigner: false, isWritable: true },
        ])
        .signers([creator])
        .rpc();

      const balance1After = await provider.connection.getBalance(r1.publicKey);
      const received = balance1After - balance1Before;
      expect(received).to.equal(rewardPool);

      const surveyAccount = await program.account.surveyAccount.fetch(
        surveyPda
      );
      expect(surveyAccount.isActive).to.be.false;
    });

    it("distributes lucky draw mock as equal split", async () => {
      const creator = Keypair.generate();
      await airdrop(creator.publicKey, 15 * LAMPORTS_PER_SOL);

      const r1 = Keypair.generate();
      const r2 = Keypair.generate();
      await airdrop(r1.publicKey, 5 * LAMPORTS_PER_SOL);
      await airdrop(r2.publicKey, 5 * LAMPORTS_PER_SOL);

      const surveyId = Buffer.from("dist-lucky-draw");
      const surveyPda = getSurveyPda(creator.publicKey, surveyId);
      const escrowPda = getEscrowPda(surveyPda);
      const rewardPool = 8 * LAMPORTS_PER_SOL;

      await program.methods
        .initializeSurvey(
          surveyId,
          new anchor.BN(rewardPool),
          { luckyDraw: {} },
          10
        )
        .accountsPartial({
          signer: creator.publicKey,
          survey: surveyPda,
          escrowVault: escrowPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      for (const r of [r1, r2]) {
        const scorePda = getScorePda(r.publicKey);
        await program.methods
          .initializeScoreAccount()
          .accountsPartial({
            authority: authority.publicKey,
            wallet: r.publicKey,
            scoreAccount: scorePda,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([authority])
          .rpc();

        const pda = getParticipantPda(surveyPda, r.publicKey);
        await program.methods
          .registerParticipant(surveyId)
          .accountsPartial({
            creator: creator.publicKey,
            survey: surveyPda,
            participant: pda,
            respondent: r.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([creator])
          .rpc();
      }

      const bal1Before = await provider.connection.getBalance(r1.publicKey);
      const bal2Before = await provider.connection.getBalance(r2.publicKey);

      const each = Math.floor(rewardPool / 2);

      await program.methods
        .distributeRewards(surveyId, [
          new anchor.BN(each),
          new anchor.BN(rewardPool - each),
        ])
        .accountsPartial({
          creator: creator.publicKey,
          survey: surveyPda,
          escrowVault: escrowPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: r1.publicKey, isSigner: false, isWritable: true },
          { pubkey: r2.publicKey, isSigner: false, isWritable: true },
        ])
        .signers([creator])
        .rpc();

      const bal1After = await provider.connection.getBalance(r1.publicKey);
      const bal2After = await provider.connection.getBalance(r2.publicKey);

      expect(bal1After - bal1Before).to.equal(each);
      expect(bal2After - bal2Before).to.equal(rewardPool - each);

      const surveyAccount = await program.account.surveyAccount.fetch(
        surveyPda
      );
      expect(surveyAccount.isActive).to.be.false;
    });

    it("rejects distribution with no participants", async () => {
      const creator = Keypair.generate();
      await airdrop(creator.publicKey, 10 * LAMPORTS_PER_SOL);

      const surveyId = Buffer.from("dist-empty");
      const surveyPda = getSurveyPda(creator.publicKey, surveyId);
      const escrowPda = getEscrowPda(surveyPda);

      await program.methods
        .initializeSurvey(
          surveyId,
          new anchor.BN(1 * LAMPORTS_PER_SOL),
          { weighted: {} },
          10
        )
        .accountsPartial({
          signer: creator.publicKey,
          survey: surveyPda,
          escrowVault: escrowPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      try {
        await program.methods
          .distributeRewards(surveyId, [])
          .accountsPartial({
            creator: creator.publicKey,
            survey: surveyPda,
            escrowVault: escrowPda,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([creator])
          .rpc();

        expect.fail("Should have thrown NoParticipants error");
      } catch (err: any) {
        expect(err.toString()).to.contain("NoParticipants");
      }
    });
  });

  describe("close_escrow", () => {
    it("sweeps the remaining rent-exemption balance back to the creator", async () => {
      const creator = Keypair.generate();
      await airdrop(creator.publicKey, 15 * LAMPORTS_PER_SOL);

      const r1 = Keypair.generate();
      await airdrop(r1.publicKey, 5 * LAMPORTS_PER_SOL);

      const surveyId = Buffer.from("close-escrow-test");
      const surveyPda = getSurveyPda(creator.publicKey, surveyId);
      const escrowPda = getEscrowPda(surveyPda);
      const rewardPool = 5 * LAMPORTS_PER_SOL;

      await program.methods
        .initializeSurvey(
          surveyId,
          new anchor.BN(rewardPool),
          { weighted: {} },
          10
        )
        .accountsPartial({
          signer: creator.publicKey,
          survey: surveyPda,
          escrowVault: escrowPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      const escrowBefore = await provider.connection.getBalance(escrowPda);
      expect(escrowBefore).to.be.greaterThan(rewardPool);

      // Distribute the entire reward pool, leaving only the rent buffer.
      await program.methods
        .distributeRewards(surveyId, [new anchor.BN(rewardPool)])
        .accountsPartial({
          creator: creator.publicKey,
          survey: surveyPda,
          escrowVault: escrowPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: r1.publicKey, isSigner: false, isWritable: true },
        ])
        .signers([creator])
        .rpc();

      const escrowRemaining = await provider.connection.getBalance(escrowPda);
      expect(escrowRemaining).to.be.greaterThan(0);

      const creatorBefore = await provider.connection.getBalance(
        creator.publicKey
      );

      await program.methods
        .closeEscrow(surveyId)
        .accountsPartial({
          signer: creator.publicKey,
          survey: surveyPda,
          escrowVault: escrowPda,
          beneficiary: creator.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      const creatorAfter = await provider.connection.getBalance(
        creator.publicKey
      );
      // Minus the close_escrow transaction fee (~5000 lamports).
      expect(creatorAfter - creatorBefore).to.be.greaterThan(
        escrowRemaining - 10000
      );

      const escrowAfter = await provider.connection.getBalance(escrowPda);
      expect(escrowAfter).to.equal(0);
    });

    it("rejects closing an escrow while the survey is still active", async () => {
      const creator = Keypair.generate();
      await airdrop(creator.publicKey, 10 * LAMPORTS_PER_SOL);

      const surveyId = Buffer.from("close-escrow-active");
      const surveyPda = getSurveyPda(creator.publicKey, surveyId);
      const escrowPda = getEscrowPda(surveyPda);

      await program.methods
        .initializeSurvey(
          surveyId,
          new anchor.BN(1 * LAMPORTS_PER_SOL),
          { weighted: {} },
          10
        )
        .accountsPartial({
          signer: creator.publicKey,
          survey: surveyPda,
          escrowVault: escrowPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      try {
        await program.methods
          .closeEscrow(surveyId)
          .accountsPartial({
            signer: creator.publicKey,
            survey: surveyPda,
            escrowVault: escrowPda,
            beneficiary: creator.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([creator])
          .rpc();

        expect.fail("Should have thrown SurveyNotActive error");
      } catch (err: any) {
        expect(err.toString()).to.contain("SurveyNotActive");
      }
    });
  });

  describe("collect_fee", () => {
    const authority = (provider.wallet as anchor.Wallet).payer;

    async function initSurvey(
      creator: Keypair,
      surveyId: Buffer,
      rewardPoolLamports: number
    ) {
      const surveyPda = getSurveyPda(creator.publicKey, surveyId);
      const escrowPda = getEscrowPda(surveyPda);
      await program.methods
        .initializeSurvey(
          surveyId,
          new anchor.BN(rewardPoolLamports),
          { weighted: {} },
          10
        )
        .accountsPartial({
          signer: creator.publicKey,
          survey: surveyPda,
          escrowVault: escrowPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();
      return { surveyPda, escrowPda };
    }

    it("transfers the fee from the escrow to the fee wallet", async () => {
      const creator = Keypair.generate();
      await airdrop(creator.publicKey, 10 * LAMPORTS_PER_SOL);

      const feeWallet = Keypair.generate();
      await airdrop(feeWallet.publicKey, LAMPORTS_PER_SOL);

      const surveyId = Buffer.from("collect-fee-1");
      const { surveyPda, escrowPda } = await initSurvey(
        creator,
        surveyId,
        2 * LAMPORTS_PER_SOL
      );

      const feeLamports = 100_000_000; // 0.1 SOL
      const escrowBefore = await provider.connection.getBalance(escrowPda);
      const feeWalletBefore = await provider.connection.getBalance(
        feeWallet.publicKey
      );

      await program.methods
        .collectFee(surveyId, new anchor.BN(feeLamports))
        .accountsPartial({
          authority: authority.publicKey,
          survey: surveyPda,
          escrowVault: escrowPda,
          feeWallet: feeWallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      const escrowAfter = await provider.connection.getBalance(escrowPda);
      const feeWalletAfter = await provider.connection.getBalance(
        feeWallet.publicKey
      );

      expect(escrowBefore - escrowAfter).to.equal(feeLamports);
      expect(feeWalletAfter - feeWalletBefore).to.equal(feeLamports);
    });

    it("rejects when called by a non-authority signer", async () => {
      const creator = Keypair.generate();
      await airdrop(creator.publicKey, 10 * LAMPORTS_PER_SOL);

      const surveyId = Buffer.from("collect-fee-unauthorized");
      const { surveyPda, escrowPda } = await initSurvey(
        creator,
        surveyId,
        2 * LAMPORTS_PER_SOL
      );

      try {
        await program.methods
          .collectFee(surveyId, new anchor.BN(100_000_000))
          .accountsPartial({
            authority: creator.publicKey,
            survey: surveyPda,
            escrowVault: escrowPda,
            feeWallet: creator.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([creator])
          .rpc();
        expect.fail("Should have thrown Unauthorized error");
      } catch (err: any) {
        expect(err.toString()).to.contain("Unauthorized");
      }
    });

    it("is a no-op when the fee is zero", async () => {
      const creator = Keypair.generate();
      await airdrop(creator.publicKey, 10 * LAMPORTS_PER_SOL);

      const feeWallet = Keypair.generate();
      await airdrop(feeWallet.publicKey, LAMPORTS_PER_SOL);

      const surveyId = Buffer.from("collect-fee-zero");
      const { surveyPda, escrowPda } = await initSurvey(
        creator,
        surveyId,
        2 * LAMPORTS_PER_SOL
      );

      const escrowBefore = await provider.connection.getBalance(escrowPda);

      await program.methods
        .collectFee(surveyId, new anchor.BN(0))
        .accountsPartial({
          authority: authority.publicKey,
          survey: surveyPda,
          escrowVault: escrowPda,
          feeWallet: feeWallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      const escrowAfter = await provider.connection.getBalance(escrowPda);
      expect(escrowAfter).to.equal(escrowBefore);
    });

    it("rejects when the fee exceeds the escrow balance", async () => {
      const creator = Keypair.generate();
      await airdrop(creator.publicKey, 10 * LAMPORTS_PER_SOL);

      const feeWallet = Keypair.generate();
      await airdrop(feeWallet.publicKey, LAMPORTS_PER_SOL);

      const surveyId = Buffer.from("collect-fee-too-high");
      const { surveyPda, escrowPda } = await initSurvey(
        creator,
        surveyId,
        2 * LAMPORTS_PER_SOL
      );

      try {
        await program.methods
          .collectFee(surveyId, new anchor.BN(10 * LAMPORTS_PER_SOL))
          .accountsPartial({
            authority: authority.publicKey,
            survey: surveyPda,
            escrowVault: escrowPda,
            feeWallet: feeWallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        expect.fail("Should have thrown InsufficientRewardPool error");
      } catch (err: any) {
        expect(err.toString()).to.contain("InsufficientRewardPool");
      }
    });
  });

  describe("end-to-end flow", () => {
    it("full survey lifecycle: create, register, verify state", async () => {
      const e2eCreator = Keypair.generate();
      const e2eRespondent = Keypair.generate();
      await airdrop(e2eCreator.publicKey, 10 * LAMPORTS_PER_SOL);
      await airdrop(e2eRespondent.publicKey, 5 * LAMPORTS_PER_SOL);

      const surveyId = Buffer.from("e2e-survey");
      const surveyPda = getSurveyPda(e2eCreator.publicKey, surveyId);
      const escrowPda = getEscrowPda(surveyPda);
      const participantPda = getParticipantPda(
        surveyPda,
        e2eRespondent.publicKey
      );
      const scorePda = getScorePda(e2eRespondent.publicKey);

      const rewardPool = 2 * LAMPORTS_PER_SOL;

      await program.methods
        .initializeSurvey(
          surveyId,
          new anchor.BN(rewardPool),
          { weighted: {} },
          50
        )
        .accountsPartial({
          signer: e2eCreator.publicKey,
          survey: surveyPda,
          escrowVault: escrowPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([e2eCreator])
        .rpc();

      await program.methods
        .initializeScoreAccount()
        .accountsPartial({
          authority: authority.publicKey,
          wallet: e2eRespondent.publicKey,
          scoreAccount: scorePda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      await program.methods
        .registerParticipant(surveyId)
        .accountsPartial({
          creator: e2eCreator.publicKey,
          survey: surveyPda,
          participant: participantPda,
          respondent: e2eRespondent.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([e2eCreator])
        .rpc();

      const surveyAccount = await program.account.surveyAccount.fetch(
        surveyPda
      );
      const participantAccount = await program.account.participantEntry.fetch(
        participantPda
      );
      const scoreAccount = await program.account.respondentScoreAccount.fetch(
        scorePda
      );
      const escrowBalance = await provider.connection.getBalance(escrowPda);

      expect(surveyAccount.creator.toString()).to.equal(
        e2eCreator.publicKey.toString()
      );
      expect(surveyAccount.rewardPool.toNumber()).to.equal(rewardPool);
      expect(surveyAccount.responseCount).to.equal(1);
      expect(surveyAccount.isActive).to.be.true;

      expect(participantAccount.survey.toString()).to.equal(
        surveyPda.toString()
      );
      expect(participantAccount.respondent.toString()).to.equal(
        e2eRespondent.publicKey.toString()
      );
      expect(participantAccount.hasSubmitted).to.be.false;

      expect(scoreAccount.wallet.toString()).to.equal(
        e2eRespondent.publicKey.toString()
      );
      expect(scoreAccount.globalScore).to.equal(0);
      expect(scoreAccount.badgeTier).to.deep.equal({ ghost: {} });

      expect(escrowBalance).to.be.greaterThan(rewardPool);
    });
  });

  describe("SPL Token Surveys (USDC)", () => {
    let usdcMint: PublicKey;
    let splCreator: Keypair;
    let splRespondent: Keypair;
    let splCreatorAta: PublicKey;
    let splRespondentAta: PublicKey;
    let treasuryAta: PublicKey;
    const authorityPayer = (provider.wallet as anchor.Wallet).payer;

    const USDC_DECIMALS = 6;
    const ONE_USDC = 1_000_000;

    before(async () => {
      splCreator = Keypair.generate();
      splRespondent = Keypair.generate();

      await airdrop(splCreator.publicKey, 2 * LAMPORTS_PER_SOL);
      await airdrop(splRespondent.publicKey, 1 * LAMPORTS_PER_SOL);

      // Create 6-decimal mock USDC mint
      usdcMint = await createMint(
        provider.connection,
        authorityPayer,
        authorityPayer.publicKey,
        null,
        USDC_DECIMALS
      );

      // Create creator ATA and mint 100 USDC
      const creatorAtaAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        splCreator,
        usdcMint,
        splCreator.publicKey
      );
      splCreatorAta = creatorAtaAccount.address;

      await mintTo(
        provider.connection,
        authorityPayer,
        usdcMint,
        splCreatorAta,
        authorityPayer,
        100 * ONE_USDC
      );

      // Create respondent ATA
      const respondentAtaAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        splRespondent,
        usdcMint,
        splRespondent.publicKey
      );
      splRespondentAta = respondentAtaAccount.address;

      // Create treasury ATA for authority
      const treasuryAtaAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        authorityPayer,
        usdcMint,
        authorityPayer.publicKey
      );
      treasuryAta = treasuryAtaAccount.address;
    });

    it("initializes an SPL token survey (USDC) with token escrow", async () => {
      const surveyId = Buffer.from("usdc-survey-init-1");
      const rewardPoolTokens = 10 * ONE_USDC; // 10 USDC
      const surveyPda = getSurveyPda(splCreator.publicKey, surveyId);
      const [tokenEscrowPda] = getTokenEscrowPda(surveyPda);

      await program.methods
        .initializeSurveySpl(
          surveyId,
          new anchor.BN(rewardPoolTokens),
          { weighted: {} },
          50
        )
        .accountsPartial({
          signer: splCreator.publicKey,
          survey: surveyPda,
          rewardMint: usdcMint,
          escrowVault: tokenEscrowPda,
          creatorTokenAccount: splCreatorAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([splCreator])
        .rpc();

      const surveyAccount = await program.account.surveyAccount.fetch(surveyPda);
      expect(surveyAccount.creator.toString()).to.equal(splCreator.publicKey.toString());
      expect(surveyAccount.rewardPool.toNumber()).to.equal(rewardPoolTokens);
      expect(surveyAccount.tokenMint.toString()).to.equal(usdcMint.toString());
      expect(surveyAccount.isActive).to.be.true;

      const escrowAccount = await getAccount(provider.connection, tokenEscrowPda);
      expect(Number(escrowAccount.amount)).to.equal(rewardPoolTokens);
    });

    it("rejects SPL survey initialization with non-6-decimal token mint", async () => {
      const badMint = await createMint(
        provider.connection,
        authorityPayer,
        authorityPayer.publicKey,
        null,
        9 // 9 decimals instead of 6!
      );
      const badCreatorAta = (
        await getOrCreateAssociatedTokenAccount(
          provider.connection,
          splCreator,
          badMint,
          splCreator.publicKey
        )
      ).address;
      await mintTo(
        provider.connection,
        authorityPayer,
        badMint,
        badCreatorAta,
        authorityPayer,
        10 * ONE_USDC
      );

      const surveyId = Buffer.from("usdc-bad-decimals");
      const surveyPda = getSurveyPda(splCreator.publicKey, surveyId);
      const [tokenEscrowPda] = getTokenEscrowPda(surveyPda);

      try {
        await program.methods
          .initializeSurveySpl(
            surveyId,
            new anchor.BN(10 * ONE_USDC),
            { weighted: {} },
            50
          )
          .accountsPartial({
            signer: splCreator.publicKey,
            survey: surveyPda,
            rewardMint: badMint,
            escrowVault: tokenEscrowPda,
            creatorTokenAccount: badCreatorAta,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([splCreator])
          .rpc();
        expect.fail("Should have rejected non-6-decimal mint");
      } catch (err: any) {
        expect(err.toString()).to.include("InvalidTokenDecimals");
      }
    });

    it("distributes SPL token rewards to respondent ATA", async () => {
      const surveyId = Buffer.from("usdc-survey-dist-1");
      const rewardPoolTokens = 5 * ONE_USDC;
      const surveyPda = getSurveyPda(splCreator.publicKey, surveyId);
      const [tokenEscrowPda] = getTokenEscrowPda(surveyPda);

      await program.methods
        .initializeSurveySpl(
          surveyId,
          new anchor.BN(rewardPoolTokens),
          { weighted: {} },
          50
        )
        .accountsPartial({
          signer: splCreator.publicKey,
          survey: surveyPda,
          rewardMint: usdcMint,
          escrowVault: tokenEscrowPda,
          creatorTokenAccount: splCreatorAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([splCreator])
        .rpc();

      const balBefore = await getAccount(provider.connection, splRespondentAta);

      await program.methods
        .distributeRewardsSpl(surveyId, [new anchor.BN(rewardPoolTokens)])
        .accountsPartial({
          creator: splCreator.publicKey,
          survey: surveyPda,
          escrowVault: tokenEscrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts([
          { pubkey: splRespondent.publicKey, isSigner: false, isWritable: false },
          { pubkey: splRespondentAta, isSigner: false, isWritable: true },
        ])
        .signers([splCreator])
        .rpc();

      const balAfter = await getAccount(provider.connection, splRespondentAta);
      expect(Number(balAfter.amount) - Number(balBefore.amount)).to.equal(rewardPoolTokens);

      const surveyAccount = await program.account.surveyAccount.fetch(surveyPda);
      expect(surveyAccount.isActive).to.be.false;
    });

    it("rejects SPL reward distribution if recipient ATA does not match wallet", async () => {
      const surveyId = Buffer.from("usdc-survey-dist-fail");
      const rewardPoolTokens = 5 * ONE_USDC;
      const surveyPda = getSurveyPda(splCreator.publicKey, surveyId);
      const [tokenEscrowPda] = getTokenEscrowPda(surveyPda);

      await program.methods
        .initializeSurveySpl(
          surveyId,
          new anchor.BN(rewardPoolTokens),
          { weighted: {} },
          50
        )
        .accountsPartial({
          signer: splCreator.publicKey,
          survey: surveyPda,
          rewardMint: usdcMint,
          escrowVault: tokenEscrowPda,
          creatorTokenAccount: splCreatorAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([splCreator])
        .rpc();

      // Passing creator ATA instead of respondent ATA must fail
      try {
        await program.methods
          .distributeRewardsSpl(surveyId, [new anchor.BN(rewardPoolTokens)])
          .accountsPartial({
            creator: splCreator.publicKey,
            survey: surveyPda,
            escrowVault: tokenEscrowPda,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .remainingAccounts([
            { pubkey: splRespondent.publicKey, isSigner: false, isWritable: false },
            { pubkey: splCreatorAta, isSigner: false, isWritable: true },
          ])
          .signers([splCreator])
          .rpc();
        expect.fail("Should have thrown InvalidTokenAccount error");
      } catch (err: any) {
        expect(err.toString()).to.include("InvalidTokenAccount");
      }
    });

    it("collects protocol fee in SPL tokens from escrow", async () => {
      const surveyId = Buffer.from("usdc-survey-fee-1");
      const rewardPoolTokens = 10 * ONE_USDC;
      const feeTokens = 500_000; // 0.5 USDC (5%)
      const surveyPda = getSurveyPda(splCreator.publicKey, surveyId);
      const [tokenEscrowPda] = getTokenEscrowPda(surveyPda);

      await program.methods
        .initializeSurveySpl(
          surveyId,
          new anchor.BN(rewardPoolTokens),
          { weighted: {} },
          50
        )
        .accountsPartial({
          signer: splCreator.publicKey,
          survey: surveyPda,
          rewardMint: usdcMint,
          escrowVault: tokenEscrowPda,
          creatorTokenAccount: splCreatorAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([splCreator])
        .rpc();

      const treasuryBefore = await getAccount(provider.connection, treasuryAta);

      await program.methods
        .collectFeeSpl(surveyId, new anchor.BN(feeTokens))
        .accountsPartial({
          authority: authorityPayer.publicKey,
          survey: surveyPda,
          escrowVault: tokenEscrowPda,
          feeTokenAccount: treasuryAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authorityPayer])
        .rpc();

      const treasuryAfter = await getAccount(provider.connection, treasuryAta);
      expect(Number(treasuryAfter.amount) - Number(treasuryBefore.amount)).to.equal(feeTokens);
    });

    it("closes SPL escrow and sweeps remaining tokens + refunds rent", async () => {
      const surveyId = Buffer.from("usdc-survey-close-1");
      const rewardPoolTokens = 2 * ONE_USDC;
      const surveyPda = getSurveyPda(splCreator.publicKey, surveyId);
      const [tokenEscrowPda] = getTokenEscrowPda(surveyPda);

      await program.methods
        .initializeSurveySpl(
          surveyId,
          new anchor.BN(rewardPoolTokens),
          { weighted: {} },
          50
        )
        .accountsPartial({
          signer: splCreator.publicKey,
          survey: surveyPda,
          rewardMint: usdcMint,
          escrowVault: tokenEscrowPda,
          creatorTokenAccount: splCreatorAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([splCreator])
        .rpc();

      // Close the survey to allow close_escrow
      await program.methods
        .closeSurvey(surveyId)
        .accountsPartial({
          signer: splCreator.publicKey,
          survey: surveyPda,
        })
        .signers([splCreator])
        .rpc();

      const creatorTokensBefore = await getAccount(provider.connection, splCreatorAta);

      await program.methods
        .closeEscrowSpl(surveyId)
        .accountsPartial({
          signer: splCreator.publicKey,
          survey: surveyPda,
          escrowVault: tokenEscrowPda,
          creatorTokenAccount: splCreatorAta,
          beneficiary: splCreator.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([splCreator])
        .rpc();

      const creatorTokensAfter = await getAccount(provider.connection, splCreatorAta);
      expect(Number(creatorTokensAfter.amount) - Number(creatorTokensBefore.amount)).to.equal(rewardPoolTokens);

      // Token account should now be closed / null
      const closedAccountInfo = await provider.connection.getAccountInfo(tokenEscrowPda);
      expect(closedAccountInfo).to.be.null;
    });
  });
});
