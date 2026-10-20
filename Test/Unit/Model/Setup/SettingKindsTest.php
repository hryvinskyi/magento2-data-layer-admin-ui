<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingKindInterface;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Data\SettingDescriptor;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Kind\ChoiceKind;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Kind\FlagKind;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Kind\NumberKind;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Kind\SecretKind;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Kind\TextKind;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SettingKinds;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Each kind shows a stored value the way the browser expects it and turns what the browser sends into the value to
 * store, refusing a value the setting does not take as a refused request; a secret never leaves the server and is
 * never drafted for a preview; the pool finds a kind by its code and fails loudly otherwise
 */
class SettingKindsTest extends TestCase
{
    /**
     * Only a stored `1` is a set flag; a flag is stored as `1` or `0` and takes only booleans
     *
     * @return void
     */
    public function testFlag(): void
    {
        $flag = new FlagKind();

        self::assertTrue($flag->present('1'));
        self::assertFalse($flag->present('0'));
        self::assertFalse($flag->present(null));
        self::assertFalse($flag->present('yes'));
        self::assertSame('1', $flag->toStored($this->setting('flag'), true));
        self::assertSame('0', $flag->toStored($this->setting('flag'), false));

        $this->expectException(InvalidSetupRequestException::class);
        $flag->toStored($this->setting('flag'), '1');
    }

    /**
     * The text, choice and number kinds show the stored text, empty for nothing
     *
     * @return void
     */
    public function testTextualKindsShowTheStoredText(): void
    {
        $kinds = [new TextKind(), new ChoiceKind(new PresentationStub()), new NumberKind()];
        self::assertSame(['text', 'choice', 'number'], array_map(
            static fn (SettingKindInterface $kind): string => $kind->getCode(),
            $kinds
        ));
        foreach ($kinds as $kind) {
            self::assertSame('GTM-ABC', $kind->present('GTM-ABC'));
            self::assertSame('', $kind->present(null));
        }
    }

    /**
     * Text is stored trimmed, in capitals when the setting is case-insensitive; with a pattern, only matching text
     * (after trimming and capitals) or empty text is taken
     *
     * @return void
     */
    public function testTextIsStoredTrimmedAndMatchesItsPattern(): void
    {
        $text = new TextKind();

        self::assertSame('gtm-abc', $text->toStored($this->setting('text'), '  gtm-abc '));
        self::assertSame('G-ABC123', $text->toStored($this->setting('text', true), ' g-abc123 '));
        self::assertSame('G-ABC123', $text->toStored($this->patterned('/^G-[A-Z0-9]+$/D', true), ' g-abc123 '));
        self::assertSame('', $text->toStored($this->patterned('/^G-[A-Z0-9]+$/D', true), '  '));
        self::assertSame('gtm.example.com', $text->toStored($this->patterned('/^[a-z.]+$/iD'), 'gtm.example.com'));

        try {
            $text->toStored($this->patterned('/^GTM-[A-Z0-9]+$/D'), 'GTM-abc');
            self::fail('Text that does not match the pattern is refused.');
        } catch (InvalidSetupRequestException $refusal) {
            self::assertSame('"GTM-abc" is not in the format the setting "key" takes.', $refusal->getMessage());
        }
    }

    /**
     * Every textual kind refuses anything but text
     *
     * @return void
     */
    public function testTextualKindsRefuseNonText(): void
    {
        foreach ([new TextKind(), new ChoiceKind(new PresentationStub()), new NumberKind()] as $kind) {
            try {
                $kind->toStored($this->setting($kind->getCode()), 12);
                self::fail(sprintf('The %s kind refuses a number sent as a number.', $kind->getCode()));
            } catch (InvalidSetupRequestException $refusal) {
                self::assertStringContainsString('"key"', $refusal->getMessage());
            }
        }
    }

    /**
     * A choice is taken only when it is one of the options the field offers for the setting's path
     *
     * @return void
     */
    public function testChoiceMustBeAnOption(): void
    {
        $choice = new ChoiceKind(new PresentationStub(['section/group/field' => ['sku', 'entity_id', '']]));

        self::assertSame('entity_id', $choice->toStored($this->setting('choice'), ' entity_id '));
        self::assertSame('', $choice->toStored($this->setting('choice'), ''));

        $this->expectException(InvalidSetupRequestException::class);
        $this->expectExceptionMessage('"cost" is not one of the choices of the setting "key".');
        $choice->toStored($this->setting('choice'), 'cost');
    }

    /**
     * A number is taken only as a whole number within the setting's bounds, and stored as that number
     *
     * @return void
     */
    public function testNumberMustBeAWholeNumberWithinItsBounds(): void
    {
        $number = new NumberKind();

        self::assertSame('30', $number->toStored($this->bounded(30, 1000), ' 30 '));
        self::assertSame('1000', $number->toStored($this->bounded(30, 1000), '1000'));
        self::assertSame('7', $number->toStored($this->bounded(null, null), '+7'));
        self::assertSame('-4', $number->toStored($this->bounded(null, 10), '-4'));
        foreach ([
            ['29', 30, 1000, 'The setting "key" takes a whole number from 30 to 1000.'],
            ['1001', 30, 1000, 'The setting "key" takes a whole number from 30 to 1000.'],
            ['2.5', 1, null, 'The setting "key" takes a whole number of at least 1.'],
            ['11', null, 10, 'The setting "key" takes a whole number of at most 10.'],
            ['', null, null, 'The setting "key" takes a whole number.'],
            ['07', null, null, 'The setting "key" takes a whole number.'],
        ] as [$wire, $min, $max, $message]) {
            try {
                $number->toStored($this->bounded($min, $max), $wire);
                self::fail(sprintf('"%s" is refused.', $wire));
            } catch (InvalidSetupRequestException $refusal) {
                self::assertSame($message, $refusal->getMessage());
            }
        }
    }

    /**
     * Everything but a secret can change an event, so only a secret is left out of a preview's draft
     *
     * @return void
     */
    public function testOnlyASecretIsNotPreviewable(): void
    {
        self::assertTrue((new FlagKind())->isPreviewable());
        self::assertTrue((new TextKind())->isPreviewable());
        self::assertTrue((new ChoiceKind(new PresentationStub()))->isPreviewable());
        self::assertTrue((new NumberKind())->isPreviewable());
        self::assertFalse((new SecretKind())->isPreviewable());
    }

    /**
     * A secret shows only whether it is set, never its stored value
     *
     * @return void
     */
    public function testSecretShowsOnlyWhetherItIsSet(): void
    {
        $secret = new SecretKind();

        self::assertSame(['set' => true], $secret->present('0:3:encrypted-value'));
        self::assertSame(['set' => false], $secret->present(''));
        self::assertSame(['set' => false], $secret->present(null));
        self::assertSame('s3cr3t', $secret->toStored($this->setting('secret'), ' s3cr3t '));
    }

    /**
     * A secret that is empty, not text, or made only of asterisks is refused
     *
     * @param mixed $wire
     * @return void
     */
    #[DataProvider('unusableSecrets')]
    public function testUnusableSecretIsRefused(mixed $wire): void
    {
        $this->expectException(InvalidSetupRequestException::class);

        (new SecretKind())->toStored($this->setting('secret'), $wire);
    }

    /**
     * Secrets the secret kind refuses
     *
     * @return array<string, array{mixed}>
     */
    public static function unusableSecrets(): array
    {
        return [
            'empty' => [''],
            'blank' => ['   '],
            'asterisks' => ['******'],
            'one asterisk' => ['*'],
            'not text' => [true],
            'null' => [null],
        ];
    }

    /**
     * The pool resolves a kind by its code
     *
     * @return void
     */
    public function testPoolResolvesByCode(): void
    {
        $flag = new FlagKind();
        $kinds = new SettingKinds(['flag' => $flag, 'text' => new TextKind()]);

        self::assertSame($flag, $kinds->get('flag'));
        self::assertSame('text', $kinds->get('text')->getCode());
    }

    /**
     * An unknown code fails loudly
     *
     * @return void
     */
    public function testPoolRefusesUnknownCode(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('No setting kind is registered under "colour"');

        (new SettingKinds(['flag' => new FlagKind()]))->get('colour');
    }

    /**
     * A kind registered under a key other than its code, or an item that is not a kind, fails when the pool is built
     *
     * @param array<mixed> $kinds
     * @return void
     */
    #[DataProvider('unusableRegistrations')]
    public function testPoolRefusesUnusableRegistration(array $kinds): void
    {
        $this->expectException(\InvalidArgumentException::class);

        new SettingKinds($kinds);
    }

    /**
     * Registrations the pool refuses
     *
     * @return array<string, array{array<mixed>}>
     */
    public static function unusableRegistrations(): array
    {
        return [
            'wrong key' => [['toggle' => new FlagKind()]],
            'not a kind' => [['flag' => new \stdClass()]],
        ];
    }

    /**
     * Describe a setting of a kind
     *
     * @param string $kind
     * @param bool $caseInsensitive
     * @return SettingDescriptor
     */
    private function setting(string $kind, bool $caseInsensitive = false): SettingDescriptor
    {
        return new SettingDescriptor('key', 'section/group/field', $kind, 'connect', null, $caseInsensitive);
    }

    /**
     * Describe a text setting with a format pattern
     *
     * @param string $pattern
     * @param bool $caseInsensitive
     * @return SettingDescriptor
     */
    private function patterned(string $pattern, bool $caseInsensitive = false): SettingDescriptor
    {
        return new SettingDescriptor('key', 'section/group/field', 'text', 'connect', $pattern, $caseInsensitive);
    }

    /**
     * Describe a number setting with bounds
     *
     * @param int|null $min
     * @param int|null $max
     * @return SettingDescriptor
     */
    private function bounded(?int $min, ?int $max): SettingDescriptor
    {
        return new SettingDescriptor('key', 'section/group/field', 'number', 'connect', null, false, $min, $max);
    }
}
