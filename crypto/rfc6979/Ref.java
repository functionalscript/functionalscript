// ==================================================================

import java.math.BigInteger;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.nio.charset.StandardCharsets;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Deterministic DSA signature generation. This is a sample
 * implementation designed to illustrate how deterministic DSA
 * chooses the pseudorandom value k when signing a given message.
 * This implementation was NOT optimized or hardened against
 * side-channel leaks.
 *
 * An instance is created with a hash function name, which must be
 * supported by the underlying Java virtual machine ("SHA-1" and
 * "SHA-256" should work everywhere). The data to sign is input
 * through the {@code update()} methods. The private key is set with
 * {@link #setPrivateKey}. The signature is obtained by calling
 * {@link #sign}; alternatively, {@link #signHash} can be used to
 * sign some data that has been externally hashed. The private key
 * MUST be set before generating the signature itself, but message
 * data can be input before setting the key.
 *
 * Instances are NOT thread-safe. However, once a signature has
 * been generated, the same instance can be used again for another
 * signature; {@link #setPrivateKey} need not be called again if the
 * private key has not changed. {@link #reset} can also be called to
 * cancel previously input data. Generating a signature with {@link
 * #sign} (not {@link #signHash}) also implicitly causes a
 * reset.
 *
 * ------------------------------------------------------------------
 * Copyright (c) 2013 IETF Trust and the persons identified as
 * authors of the code. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, is permitted pursuant to, and subject to the license
 * terms contained in, the Simplified BSD License set forth in Section
 * 4.c of the IETF Trust's Legal Provisions Relating to IETF Documents
 * (http://trustee.ietf.org/license-info).
 *
 * Technical remarks and questions can be addressed to:
 * pornin@bolet.org
 * ------------------------------------------------------------------
 */

class DeterministicDSA {

        private String macName;
        private MessageDigest dig;
        private Mac hmac;
        private BigInteger p, q, g, x;
        private int qlen, rlen, rolen, holen;
        private byte[] bx;

        /**
         * Create an instance, using the specified hash function.
         * The name is used to obtain from the JVM an implementation
         * of the hash function and an implementation of HMAC.
         *
         * @param hashName the hash function name
         * @throws IllegalArgumentException on unsupported name
         */
        public DeterministicDSA(String hashName) {
                try {
                        dig = MessageDigest.getInstance(hashName);
                } catch (NoSuchAlgorithmException nsae) {
                        throw new IllegalArgumentException(nsae);
                }
                if (hashName.indexOf('-') < 0) {
                        macName = "Hmac" + hashName;
                } else {
                        StringBuilder sb = new StringBuilder();
                        sb.append("Hmac");
                        int n = hashName.length();
                        for (int i = 0; i < n; i++) {
                                char c = hashName.charAt(i);
                                if (c != '-') {
                                        sb.append(c);
                                }
                        }
                        macName = sb.toString();
                }
                try {
                        hmac = Mac.getInstance(macName);
                } catch (NoSuchAlgorithmException nsae) {
                        throw new IllegalArgumentException(nsae);
                }
                holen = hmac.getMacLength();
        }

        /**
         * Set the private key.
         *
         * @param p key parameter: field modulus
         * @param q key parameter: subgroup order
         * @param g key parameter: generator
         * @param x private key
         */
        public void setPrivateKey(BigInteger p, BigInteger q,
                        BigInteger g, BigInteger x) {
                /*
                 * Perform some basic sanity checks. We do not
                 * check primality of p or q because that would
                 * be too expensive.
                 *
                 * We reject keys where q is longer than 999 bits,
                 * because it would complicate signature encoding.
                 * Normal DSA keys do not have a q longer than 256
                 * bits anyway.
                 */
                if (p == null || q == null || g == null || x == null
                                || p.signum() <= 0 || q.signum() <= 0
                                || g.signum() <= 0 || x.signum() <= 0
                                || x.compareTo(q) >= 0 || q.compareTo(p) >= 0
                                || q.bitLength() > 999
                                || g.compareTo(p) >= 0 || g.bitLength() == 1
                                || g.modPow(q, p).bitLength() != 1) {
                        throw new IllegalArgumentException(
                                        "invalid DSA private key");
                }
                this.p = p;
                this.q = q;
                this.g = g;
                this.x = x;
                qlen = q.bitLength();
                if (q.signum() <= 0 || qlen < 8) {
                        throw new IllegalArgumentException(
                                        "bad group order: " + q);
                }
                rolen = (qlen + 7) >>> 3;
                rlen = rolen * 8;

                /*
                 * Convert the private exponent (x) into a sequence
                 * of octets.
                 */
                bx = int2octets(x);
        }

        private BigInteger bits2int(byte[] in) {
                BigInteger v = new BigInteger(1, in);
                int vlen = in.length * 8;
                if (vlen > qlen) {
                        v = v.shiftRight(vlen - qlen);
                }
                return v;
        }

        private byte[] int2octets(BigInteger v) {
                byte[] out = v.toByteArray();
                if (out.length < rolen) {
                        byte[] out2 = new byte[rolen];
                        System.arraycopy(out, 0,
                                        out2, rolen - out.length,
                                        out.length);
                        return out2;
                } else if (out.length > rolen) {
                        byte[] out2 = new byte[rolen];
                        System.arraycopy(out, out.length - rolen,
                                        out2, 0, rolen);
                        return out2;
                } else {
                        return out;
                }
        }

        private byte[] bits2octets(byte[] in) {
                BigInteger z1 = bits2int(in);
                BigInteger z2 = z1.subtract(q);
                return int2octets(z2.signum() < 0 ? z1 : z2);
        }

        /**
         * Set (or reset) the secret key used for HMAC.
         *
         * @param K the new secret key
         */
        private void setHmacKey(byte[] K) {
                try {
                        hmac.init(new SecretKeySpec(K, macName));
                } catch (InvalidKeyException ike) {
                        throw new IllegalArgumentException(ike);
                }
        }

        /**
         * Compute the pseudorandom k for signature generation,
         * using the process specified for deterministic DSA.
         *
         * @param h1 the hashed message
         * @return the pseudorandom k to use
         */
        private BigInteger computek(byte[] h1) {
                /*
                 * Convert hash value into an appropriately truncated
                 * and/or expanded sequence of octets. The private
                 * key was already processed (into field bx[]).
                 */
                byte[] bh = bits2octets(h1);

                /*
                 * HMAC is always used with K as key.
                 * Whenever K is updated, we reset the
                 * current HMAC key.
                 */

                /* step b. */
                byte[] V = new byte[holen];
                for (int i = 0; i < holen; i++) {
                        V[i] = 0x01;
                }

                /* step c. */
                byte[] K = new byte[holen];
                setHmacKey(K);

                /* step d. */
                hmac.update(V);
                hmac.update((byte) 0x00);
                hmac.update(bx);
                hmac.update(bh);
                K = hmac.doFinal();
                setHmacKey(K);

                /* step e. */
                hmac.update(V);
                V = hmac.doFinal();

                /* step f. */
                hmac.update(V);
                hmac.update((byte) 0x01);
                hmac.update(bx);
                hmac.update(bh);
                K = hmac.doFinal();
                setHmacKey(K);

                /* step g. */
                hmac.update(V);
                V = hmac.doFinal();

                /* step h. */
                byte[] T = new byte[rolen];
                for (;;) {
                        /*
                         * We want qlen bits, but we support only
                         * hash functions with an output length
                         * multiple of 8;acd hence, we will gather
                         * rlen bits, i.e., rolen octets.
                         */
                        int toff = 0;
                        while (toff < rolen) {
                                hmac.update(V);
                                V = hmac.doFinal();
                                int cc = Math.min(V.length,
                                                T.length - toff);
                                System.arraycopy(V, 0, T, toff, cc);
                                toff += cc;
                        }
                        BigInteger k = bits2int(T);
                        if (k.signum() > 0 && k.compareTo(q) < 0) {
                                return k;
                        }

                        /*
                         * k is not in the proper range; update
                         * K and V, and loop.
                         */
                        hmac.update(V);
                        hmac.update((byte) 0x00);
                        K = hmac.doFinal();
                        setHmacKey(K);
                        hmac.update(V);
                        V = hmac.doFinal();
                }
        }

        /**
         * Process one more byte of input data (message to sign).
         *
         * @param in the extra input byte
         */
        public void update(byte in) {
                dig.update(in);
        }

        /**
         * Process some extra bytes of input data (message to sign).
         *
         * @param in the extra input bytes
         */
        public void update(byte[] in) {
                dig.update(in, 0, in.length);
        }

        /**
         * Process some extra bytes of input data (message to sign).
         *
         * @param in  the extra input buffer
         * @param off the extra input offset
         * @param len the extra input length (in bytes)
         */
        public void update(byte[] in, int off, int len) {
                dig.update(in, off, len);
        }

        /**
         * Produce the signature. {@link #setPrivateKey} MUST have
         * been called. The signature is computed over the data
         * that was input through the {@code update*()} methods.
         * This engine is then reset (made ready for a new
         * signature generation).
         *
         * @return the signature
         */
        public byte[] sign() {
                return signHash(dig.digest());
        }

        /**
         * Produce the signature. {@link #setPrivateKey} MUST
         * have been called. The signature is computed over the
         * provided hash value (data is assumed to have been hashed
         * externally). The data that was input through the
         * {@code update*()} methods is ignored, but kept.
         *
         * If the hash output is longer than the subgroup order
         * (the length of q, in bits, denoted 'qlen'), then the
         * provided value {@code h1} can be truncated, provided that
         * at least qlen leading bits are preserved. In other words,
         * bit values in {@code h1} beyond the first qlen bits are
         * ignored.
         *
         * @param h1 the hash value
         * @return the signature
         */
        public byte[] signHash(byte[] h1) {
                if (p == null) {
                        throw new IllegalStateException(
                                        "no private key set");
                }
                try {
                        BigInteger k = computek(h1);
                        BigInteger r = g.modPow(k, p).mod(q);
                        BigInteger s = k.modInverse(q).multiply(
                                        bits2int(h1).add(x.multiply(r)))
                                        .mod(q);

                        /*
                         * Signature encoding: ASN.1 SEQUENCE of
                         * two INTEGERs. The conditions on q
                         * imply that the encoded version of r and
                         * s is no longer than 127 bytes for each,
                         * including DER tag and length.
                         */
                        byte[] br = r.toByteArray();
                        byte[] bs = s.toByteArray();
                        int ulen = br.length + bs.length + 4;
                        int slen = ulen + (ulen >= 128 ? 3 : 2);
                        byte[] sig = new byte[slen];
                        int i = 0;
                        sig[i++] = 0x30;
                        if (ulen >= 128) {
                                sig[i++] = (byte) 0x81;
                                sig[i++] = (byte) ulen;
                        } else {
                                sig[i++] = (byte) ulen;
                        }
                        sig[i++] = 0x02;
                        sig[i++] = (byte) br.length;
                        System.arraycopy(br, 0, sig, i, br.length);
                        i += br.length;
                        sig[i++] = 0x02;
                        sig[i++] = (byte) bs.length;
                        System.arraycopy(bs, 0, sig, i, bs.length);
                        return sig;

                } catch (ArithmeticException ae) {
                        throw new IllegalArgumentException(
                                        "DSA error (bad key ?)", ae);
                }
        }

        /**
         * Reset this engine. Data input through the {@code
         * update*()} methods is discarded. The current private key,
         * if one was set, is kept unchanged.
         */
        public void reset() {
                dig.reset();
        }

        public BigInteger computeK(BigInteger q, BigInteger x, byte[] h1) {
                if (q == null || x == null || q.signum() <= 0 || x.signum() <= 0
                                || x.compareTo(q) >= 0) {
                        throw new IllegalArgumentException("invalid key parameters");
                }
                this.q = q;
                qlen = q.bitLength();
                if (qlen < 8) {
                        throw new IllegalArgumentException("bad group order: " + q);
                }
                rolen = (qlen + 7) >>> 3;
                rlen = rolen * 8;
                bx = int2octets(x);
                return computek(h1);
        }
}

// ==================================================================

public class Ref {
        public static void main(String[] args) {
                record TestVector(String name, BigInteger q, BigInteger x,
                                BigInteger[] sample, BigInteger[] test) {
                }

                final TestVector[] vectors = new TestVector[] {
                        new TestVector("x1",
                                        new BigInteger(
                                                        "996F967F6C8E388D9E28D01E205FBA957A5698B1",
                                                        16),
                                        new BigInteger(
                                                        "411602CB19A6CCC34494D79D98EF1E7ED5AF25F7",
                                                        16),
                                        new BigInteger[] {
                                                        new BigInteger(
                                                                        "562097C06782D60C3037BA7BE104774344687649",
                                                                        16),
                                                        new BigInteger(
                                                                        "519BA0546D0C39202A7D34D7DFA5E760B318BCFB",
                                                                        16),
                                                        new BigInteger(
                                                                        "95897CD7BBB944AA932DBC579C1C09EB6FCFC595",
                                                                        16),
                                                        new BigInteger(
                                                                        "09ECE7CA27D0F5A4DD4E556C9DF1D21D28104F8B",
                                                                        16) },
                                        new BigInteger[] {
                                                        new BigInteger(
                                                                        "4598B8EFC1A53BC8AECD58D1ABBB0C0C71E67297",
                                                                        16),
                                                        new BigInteger(
                                                                        "5A67592E8128E03A417B0484410FB72C0B630E1A",
                                                                        16),
                                                        new BigInteger(
                                                                        "220156B761F6CA5E6C9F1B9CF9C24BE25F98CD89",
                                                                        16),
                                                        new BigInteger(
                                                                        "65D2C2EEB175E370F28C75BFCDC028D22C7DBE9C",
                                                                        16) }),
                        new TestVector("x2",
                                        new BigInteger(
                                                        "F2C3119374CE76C9356990B465374A17F23F9ED35089BD969F61C6DDE9998C1F",
                                                        16),
                                        new BigInteger(
                                                        "69C7548C21D0DFEA6B9A51C9EAD4E27C33D3B3F180316E5BCAB92C933F0E4DBC",
                                                        16),
                                        new BigInteger[] {
                                                        new BigInteger(
                                                                        "BC372967702082E1AA4FCE892209F71AE4AD25A6DFD869334E6F153BD0C4D806",
                                                                        16),
                                                        new BigInteger(
                                                                        "8926A27C40484216F052F4427CFD5647338B7B3939BC6573AF4333569D597C52",
                                                                        16),
                                                        new BigInteger(
                                                                        "C345D5AB3DA0A5BCB7EC8F8FB7A7E96069E03B206371EF7D83E39068EC564920",
                                                                        16),
                                                        new BigInteger(
                                                                        "5A12994431785485B3F5F067221517791B85A597B7A9436995C89ED0374668FC",
                                                                        16) },
                                        new BigInteger[] {
                                                        new BigInteger(
                                                                        "06BD4C05ED74719106223BE33F2D95DA6B3B541DAD7BFBD7AC508213B6DA6670",
                                                                        16),
                                                        new BigInteger(
                                                                        "1D6CE6DDA1C5D37307839CD03AB0A5CBB18E60D800937D67DFB4479AAC8DEAD7",
                                                                        16),
                                                        new BigInteger(
                                                                        "206E61F73DBE1B2DC8BE736B22B079E9DACD974DB00EEBBC5B64CAD39CF9F91C",
                                                                        16),
                                                        new BigInteger(
                                                                        "AFF1651E4CD6036D57AA8B2A05CCF1A9D5A40166340ECBBDC55BE10B568AA0AA",
                                                                        16) }),
                        new TestVector("x3",
                                        new BigInteger(
                                                        "FFFFFFFFFFFFFFFFFFFFFFFF99DEF836146BC9B1B4D22831",
                                                        16),
                                        new BigInteger(
                                                        "6FAB034934E4C0FC9AE67F5B5659A9D7D1FEFD187EE09FD4",
                                                        16),
                                        new BigInteger[] {
                                                        new BigInteger(
                                                                        "4381526B3FC1E7128F202E194505592F01D5FF4C5AF015D8",
                                                                        16),
                                                        new BigInteger(
                                                                        "32B1B6D7D42A05CB449065727A84804FB1A3E34D8F261496",
                                                                        16),
                                                        new BigInteger(
                                                                        "4730005C4FCB01834C063A7B6760096DBE284B8252EF4311",
                                                                        16),
                                                        new BigInteger(
                                                                        "A2AC7AB055E4F20692D49209544C203A7D1F2C0BFBC75DB1",
                                                                        16) },
                                        new BigInteger[] {
                                                        new BigInteger(
                                                                        "F5DC805F76EF851800700CCE82E7B98D8911B7D510059FBE",
                                                                        16),
                                                        new BigInteger(
                                                                        "5C4CE89CF56D9E7C77C8585339B006B97B5F0680B4306C6C",
                                                                        16),
                                                        new BigInteger(
                                                                        "5AFEFB5D3393261B828DB6C91FBC68C230727B030C975693",
                                                                        16),
                                                        new BigInteger(
                                                                        "0758753A5254759C7CFBAD2E2D9B0792EEE44136C9480527",
                                                                        16) }),
                        new TestVector("x4",
                                        new BigInteger(
                                                        "FFFFFFFFFFFFFFFFFFFFFFFFFFFF16A2E0B8F03E13DD29455C5C2A3D",
                                                        16),
                                        new BigInteger(
                                                        "F220266E1105BFE3083E03EC7A3A654651F45E37167E88600BF257C1",
                                                        16),
                                        new BigInteger[] {
                                                        new BigInteger(
                                                                        "C1D1F2F10881088301880506805FEB4825FE09ACB6816C36991AA06D",
                                                                        16),
                                                        new BigInteger(
                                                                        "AD3029E0278F80643DE33917CE6908C70A8FF50A411F06E41DEDFCDC",
                                                                        16),
                                                        new BigInteger(
                                                                        "52B40F5A9D3D13040F494E83D3906C6079F29981035C7BD51E5CAC40",
                                                                        16),
                                                        new BigInteger(
                                                                        "9DB103FFEDEDF9CFDBA05184F925400C1653B8501BAB89CEA0FBEC14",
                                                                        16) },
                                        new BigInteger[] {
                                                        new BigInteger(
                                                                        "DF8B38D40DCA3E077D0AC520BF56B6D565134D9B5F2EAE0D34900524",
                                                                        16),
                                                        new BigInteger(
                                                                        "FF86F57924DA248D6E44E8154EB69F0AE2AEBAEE9931D0B5A969F904",
                                                                        16),
                                                        new BigInteger(
                                                                        "7046742B839478C1B5BD31DB2E862AD868E1A45C863585B5F22BDC2D",
                                                                        16),
                                                        new BigInteger(
                                                                        "E39C2AA4EA6BE2306C72126D40ED77BF9739BB4D6EF2BBB1DCB6169D",
                                                                        16) }),
                        new TestVector("x5",
                                        new BigInteger(
                                                        "FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551",
                                                        16),
                                        new BigInteger(
                                                        "519B423D715F8B5D549E44CF7C2D54C38E84AA05FADC4E5F",
                                                        16),
                                        new BigInteger[] {
                                                        new BigInteger(
                                                                        "4B4CE35A7F267665A8CA2C0EB5E629A3C53C2AA054E2DA04E97CFA7A",
                                                                        16),
                                                        new BigInteger(
                                                                        "2E44D5602A1BCA1CC1A96A6A98546C9FDB092892D4250E8857D1D6AD",
                                                                        16),
                                                        new BigInteger(
                                                                        "3FB7D5833D7E31FFCE33399B1BCAD1216D5C37D6899F9164000029E3",
                                                                        16),
                                                        new BigInteger(
                                                                        "A007C498479454D5E9A9B235F15BA0CABD441D494A5F916255F04FB0",
                                                                        16) },
                                        new BigInteger[] {
                                                        new BigInteger(
                                                                        "61AA3DA010993EA48189273F9E857D441436021B0B91E04E8EF1D2C1",
                                                                        16),
                                                        new BigInteger(
                                                                        "DCEF34E5539056D5732E4E6A5A456887395BBA6A60BD5715FC026E70",
                                                                        16),
                                                        new BigInteger(
                                                                        "D1FCB6AA187378217F2D0179E5B7CEDE742454EECC3457107D45EF24",
                                                                        16),
                                                        new BigInteger(
                                                                        "587118B38FBDB08D4A9D749AF30D9D2614CE1DBC67DB2F339A7BE35A",
                                                                        16) }) };

                final String[] hashAlgos = new String[] { "SHA-224", "SHA-256",
                                "SHA-384", "SHA-512" };

                for (TestVector vector : vectors) {
                        for (int i = 0; i < hashAlgos.length; i++) {
                                DeterministicDSA dsa = new DeterministicDSA(hashAlgos[i]);
                                BigInteger sampleK = dsa.computeK(vector.q, vector.x,
                                                hash(hashAlgos[i], "sample"));
                                BigInteger testK = dsa.computeK(vector.q, vector.x,
                                                hash(hashAlgos[i], "test"));
                                System.out.printf("%s %s sample k: %s (expected %s)%n",
                                                vector.name, hashAlgos[i],
                                                sampleK.toString(16),
                                                vector.sample[i].toString(16));
                                System.out.printf("%s %s test   k: %s (expected %s)%n",
                                                vector.name, hashAlgos[i], testK.toString(16),
                                                vector.test[i].toString(16));
                        }
                }
        }

        private static byte[] hash(String hashName, String message) {
                try {
                        MessageDigest digest = MessageDigest.getInstance(hashName);
                        return digest.digest(message.getBytes(StandardCharsets.US_ASCII));
                } catch (NoSuchAlgorithmException e) {
                        throw new IllegalArgumentException(e);
                }
        }
}
